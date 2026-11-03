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

/** The kit scripts the tests evaluate, in load order (photos and places need core; summary needs nothing). */
const FILES = ['core/mco-core.js', 'photos/mco-photos.js', 'places/mco-places.js', 'summary/mco-summary.js']

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
  if (got !== f.integrity) throw new Error(`${f.url}: integrity mismatch (pinned ${f.integrity}, got ${got})`)
  return bytes
}

/**
 * Data a kit script fetches from its own tag, pinned by a hash that script carries (so by its SRI too):
 * MCO.places' gazetteer. [published path, the script, the constant holding the hash].
 */
const DATA: [string, string, string][] = [['places/mt-places.json', 'places/mco-places.js', 'DATA_INTEGRITY']]

/** Each DATA file at the pinned tag, with the integrity its (SRI-checked, cached) script names. */
export function kitDataFiles(): KitFile[] {
  const scripts = kitFiles()
  return DATA.map(([path, script, constant]) => {
    const s = scripts.find((f) => f.path === script)
    if (!s) throw new Error(`${path}: its script ${script} is not in FILES`)
    const src = verified(s, readFileSync(s.cachePath)).toString('utf8')
    const integrity = new RegExp(`\\.${constant} = '(sha384-[A-Za-z0-9+/=]+)'`).exec(src)?.[1]
    if (!integrity) throw new Error(`${script} names no ${constant}`)
    return { path, url: s.url.replace(script, path), integrity, cachePath: s.cachePath.replace(script, path) }
  })
}

async function cache(f: KitFile): Promise<void> {
  if (existsSync(f.cachePath)) {
    verified(f, readFileSync(f.cachePath))
    return
  }
  const res = await fetch(f.url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${f.url}: HTTP ${res.status}`)
  const bytes = verified(f, Buffer.from(await res.arrayBuffer()))
  mkdirSync(dirname(f.cachePath), { recursive: true })
  writeFileSync(f.cachePath, bytes)
}

/** Download any pinned file (scripts, then their data) not yet cached, checked against its hash before it is written. */
export async function ensureKit(): Promise<void> {
  for (const f of kitFiles()) await cache(f)
  for (const f of kitDataFiles()) await cache(f)
}

/** A kit data file's text (cached by globalSetup), re-checked against its hash. */
export function kitData(path: string): string {
  const f = kitDataFiles().find((d) => d.path === path)
  if (!f) throw new Error(`${path} is not a kit data file (test/kit.ts DATA)`)
  if (!existsSync(f.cachePath)) throw new Error(`${path} @ ${f.url} is not cached: vitest's globalSetup (test/kit-global.ts) fetches it`)
  return verified(f, readFileSync(f.cachePath)).toString('utf8')
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
