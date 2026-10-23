/**
 * The kit files the unit tests run against: the SAME pinned bytes the page loads (website DECISIONS
 * D15), never a copy. index.html is the only place the kit version and SRI hashes are written; this
 * reads them from there, so a pin bump moves the tests with it.
 *
 * `ensureKit()` (vitest globalSetup, once per run) downloads each file into node_modules/.cache/mco-kit/
 * the first time and checks it against its `integrity` hash; `loadKit()` (setupFiles, every test
 * worker) re-checks the cached bytes and evaluates them, core first, in a node:vm context whose
 * `window` is the context itself (mco-web-style README "Testing against the kit in Node"). A hash
 * mismatch fails the run. Values from the context cross a realm boundary: compare them structurally.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import type { Mco } from '../src/types/mco'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'node_modules', '.cache', 'mco-kit')

/** The kit scripts the tests evaluate, in load order (photos needs core). */
const FILES = ['core/mco-core.js', 'photos/mco-photos.js']

interface KitFile {
  path: string
  url: string
  integrity: string
  cachePath: string
}

/** The pinned URL + integrity of each file in FILES, as index.html loads them. */
export function kitFiles(html = readFileSync(join(ROOT, 'index.html'), 'utf8')): KitFile[] {
  return FILES.map((path) => {
    const tag = new RegExp(`<script src="(https://cdn\\.jsdelivr\\.net/gh/mt-climate-office/mco-web-style@([\\d.]+)/${path.replace(/[.]/g, '\\.')})"\\s+integrity="(sha384-[A-Za-z0-9+/=]+)"`).exec(html)
    if (!tag) throw new Error(`index.html does not load ${path} from a pinned kit tag with integrity`)
    return { path, url: tag[1], integrity: tag[3], cachePath: join(CACHE, tag[2], path) }
  })
}

const sri = (bytes: Buffer) => `sha384-${createHash('sha384').update(bytes).digest('base64')}`

export function verified(f: KitFile, bytes: Buffer): Buffer {
  const got = sri(bytes)
  if (got !== f.integrity) throw new Error(`${f.url}: integrity mismatch (index.html pins ${f.integrity}, got ${got})`)
  return bytes
}

/** Download any pinned file not yet cached, checked against its SRI before it is written. */
export async function ensureKit(): Promise<void> {
  for (const f of kitFiles()) {
    if (existsSync(f.cachePath)) {
      verified(f, readFileSync(f.cachePath))
      continue
    }
    const res = await fetch(f.url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`${f.url}: HTTP ${res.status}`)
    const bytes = verified(f, Buffer.from(await res.arrayBuffer()))
    mkdirSync(dirname(f.cachePath), { recursive: true })
    writeFileSync(f.cachePath, bytes)
  }
}

/** A stub DOM element: enough for mco-core.js to load (it only wires listeners and reads attributes). */
function stubElement(tag: string) {
  return {
    tagName: tag.toUpperCase(),
    className: '',
    style: { setProperty() {}, removeProperty() {} },
    dataset: {},
    children: [],
    setAttribute() {},
    getAttribute: () => null,
    removeAttribute() {},
    append() {},
    appendChild: (c: unknown) => c,
    addEventListener() {},
    removeEventListener() {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelector: () => null,
    querySelectorAll: () => [],
  }
}

/** Evaluate the cached, SRI-checked kit files and return the context's `MCO`. */
export function loadKit(): Mco {
  const matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
  const sandbox: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    fetch: (...a: Parameters<typeof fetch>) => fetch(...a),
    AbortSignal,
    URLSearchParams,
    matchMedia,
    location: { search: '', pathname: '/', hash: '', href: 'http://localhost/' },
    history: { state: null, replaceState() {}, pushState() {} },
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    document: {
      documentElement: stubElement('html'),
      body: stubElement('body'),
      head: stubElement('head'),
      readyState: 'complete',
      createElement: stubElement,
      addEventListener() {},
      removeEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  for (const f of kitFiles()) {
    if (!existsSync(f.cachePath)) throw new Error(`${f.path} @ ${f.url} is not cached: vitest's globalSetup (test/kit-global.ts) fetches it`)
    vm.runInContext(verified(f, readFileSync(f.cachePath)).toString('utf8'), sandbox, { filename: f.url })
  }
  return sandbox.MCO as Mco
}
