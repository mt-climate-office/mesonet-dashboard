/**
 * Shared Playwright harness for scripts/verify/*: serves the built dist/ with
 * `vite preview`, opens pages with every third-party request answered from
 * fixtures/ (deterministic; `VERIFY_RECORD=1` fetches and saves missing ones),
 * pins the clock to the recording time, and collects console errors and CSP
 * violations. `VERIFY_CHANNEL=chrome` uses installed Chrome instead of the bundled Chromium.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { chromium } from 'playwright'
import { preview } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(here, '..', '..')
const FIX_DIR = join(here, 'fixtures')
const INDEX = join(FIX_DIR, 'index.json')
const RECORD = process.env.VERIFY_RECORD === '1'

export const THEMES = ['dark', 'light', 'high-contrast']
// 390 is a touch phone, so `(hover: none)` matches and the touch-target rules apply.
export const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844, touch: true },
]

/* ── Network: what may go live, what is stubbed, what comes from fixtures ── */

// SRI-pinned kit + MapLibre bundles: versioned and immutable, so loaded live.
const LIVE_HOSTS = new Set(['cdn.jsdelivr.net', 'unpkg.com'])
// The CARTO basemap is replaced by an empty style: its tiles are megabytes and
// carry nothing axe can check. `glyphs` stays because the tribal-label layer needs it.
const STUB_STYLE = JSON.stringify({
  version: 8,
  glyphs: 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#808080' } }],
})

/** A solid 256×256 RGB PNG (no deps): stands in for DEM tiles and station photos, which are ~100 KB–1 MB each. */
function solidPng([r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const td = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(12 + data.length)
    out.writeUInt32BE(data.length, 0)
    td.copy(out, 4)
    out.writeUInt32BE(crc(td), 8 + data.length)
    return out
  }
  const size = 256
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8) // 8-bit RGB
  const row = Buffer.alloc(1 + size * 3)
  for (let i = 0; i < size; i++) row.set([r, g, b], 1 + i * 3)
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
// Terrarium encoding: elevation = R*256 + G + B/256 − 32768 → (131, 232, 0) is a flat 1000 m.
const FLAT_DEM = solidPng([131, 232, 0])

/** Fixture trims applied at record time, keyed by URL prefix (keep the set small). */
const TRIM = {
  // The photo schedule lists every station (~440 KB); the verify runs only open acebozem.
  'https://data2.climate.umt.edu/mesonet/photos/schedule/schedule.json': (buf) => {
    const d = JSON.parse(buf.toString())
    d.stations = { acebozem: d.stations.acebozem }
    return Buffer.from(JSON.stringify(d))
  },
}

const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : { recordedAt: null, entries: {} }
/** Recording time: the page clock starts here so date-derived request URLs match the fixtures. */
export const NOW = index.recordedAt ?? new Date().toISOString()
if (RECORD && !index.recordedAt) index.recordedAt = NOW

const EXT = { 'text/csv': '.csv', 'application/json': '.json', 'application/geo+json': '.json', 'image/png': '.png', 'image/webp': '.webp', 'application/xml': '.xml', 'text/plain': '.txt' }
const fileFor = (url, type) => {
  const u = new URL(url)
  const slug = (u.pathname.split('/').filter(Boolean).slice(-2).join('_') || 'root').replace(/[^\w.-]+/g, '_').slice(0, 40)
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 10)
  return `${u.hostname.split('.')[0]}-${slug}-${hash}${EXT[type.split(';')[0].trim()] ?? ''}`
}

/** Unfixtured third-party requests seen this run (each one fails the run). */
const unfixtured = new Set()

/** Route one request; `state.pending` counts data requests (fixtures/recording) still being answered. */
async function handle(route, state) {
  const req = route.request()
  const url = req.url()
  const u = new URL(url)
  if (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.protocol === 'blob:' || u.protocol === 'data:') return route.continue()
  if (LIVE_HOSTS.has(u.hostname)) return route.continue()
  if (u.hostname === 'basemaps.cartocdn.com' && u.pathname.endsWith('/style.json')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: STUB_STYLE })
  }
  if (u.hostname === 's3.amazonaws.com' || (u.hostname === 'data2.climate.umt.edu' && u.pathname.endsWith('.webp'))) {
    return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: FLAT_DEM })
  }
  state.pending++
  try {
    return await answer(route, url)
  } finally {
    state.pending--
    state.lastDone = Date.now()
  }
}

async function answer(route, url) {
  const hit = index.entries[url]
  if (hit) {
    return route.fulfill({
      status: hit.status,
      headers: { 'content-type': hit.type, 'access-control-allow-origin': '*' },
      body: hit.file ? readFileSync(join(FIX_DIR, hit.file)) : '',
    })
  }
  if (RECORD) {
    const res = await route.fetch()
    const type = res.headers()['content-type'] ?? 'application/octet-stream'
    const trim = Object.entries(TRIM).find(([prefix]) => url.startsWith(prefix))?.[1]
    const body = trim && res.ok() ? trim(await res.body()) : await res.body()
    const file = body.length ? fileFor(url, type) : null
    if (file) writeFileSync(join(FIX_DIR, file), body)
    index.entries[url] = { status: res.status(), type, file }
    writeFileSync(INDEX, JSON.stringify(index, null, 1) + '\n')
    return route.fulfill({ status: res.status(), headers: { 'content-type': type, 'access-control-allow-origin': '*' }, body })
  }
  unfixtured.add(url)
  return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' })
}

/* ── Server, browser, pages ─────────────────────────────────────────────── */

/** Serve dist/ (run `vite build` first) and launch the browser. Call `close()` when done. */
export async function start() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) throw new Error('dist/ missing: run `npm run build` first')
  if (RECORD) mkdirSync(FIX_DIR, { recursive: true })
  const server = await preview({ root: ROOT, logLevel: 'silent', preview: { port: 0, host: '127.0.0.1' } })
  const base = server.resolvedUrls.local[0]
  const browser = await chromium.launch({
    channel: process.env.VERIFY_CHANNEL || undefined,
    // MapLibre needs WebGL; GPU-less CI runners only get it from SwiftShader, which Chrome no longer enables by default.
    args: ['--enable-unsafe-swiftshader'],
  })
  return {
    base,
    browser,
    async close() {
      await browser.close()
      await new Promise((r) => server.httpServer.close(r))
    },
  }
}

/**
 * New context + page at `base + query` with fixtures routed, clock pinned and
 * diagnostics collected in `errors` (console errors, page errors, CSP violations).
 * `reducedMotion` emulates prefers-reduced-motion.
 */
export async function open(env, query, { viewport = VIEWPORTS[0], reducedMotion = 'no-preference' } = {}) {
  const ctx = await env.browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion,
    // Pinned so date-derived request URLs (and the fixtures) match on a UTC CI runner.
    timezoneId: 'America/Denver',
    locale: 'en-US',
    ...(viewport.touch ? { isMobile: true, hasTouch: true } : {}),
  })
  const state = { pending: 0, lastDone: 0 }
  await ctx.route('**/*', (route) => handle(route, state))
  await ctx.clock.setSystemTime(new Date(NOW))
  await ctx.addInitScript(() => {
    // Recorded explicitly (with directive and URL) rather than parsed out of console text.
    window.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`)
    })
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // The API answers 404 for "no data" (e.g. an annual-comparison year before the sensor existed),
    // which the app treats as empty; Chrome still logs the 404. Only those recorded 404s are excused.
    const hit = index.entries[m.location().url]
    if (m.text().startsWith('Failed to load resource') && hit?.status === 404 && m.location().url.startsWith('https://mesonet2.')) return
    errors.push(`console: ${m.text()}${m.location().url ? ` (${m.location().url})` : ''}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.goto(env.base + query, { waitUntil: 'load' })
  return {
    ctx,
    page,
    /** Close the context; in-flight routed requests are dropped, not thrown. */
    async close() {
      await ctx.unrouteAll({ behavior: 'ignoreErrors' })
      await ctx.close()
    },
    /**
     * Render evidence (never networkidle; map tiles never idle): resolves when the visible tab
     * panel holds at least `charts` drawn charts (an ECharts <canvas> with a size and a filled
     * sr-only table twin), every selector in `filled` has children, and no data request has been
     * in flight for 750 ms (late layers such as GDD normals and the NWS projection).
     */
    async rendered({ charts = 0, filled = [] } = {}, timeout = 30000) {
      await page.waitForFunction(
        ({ charts, filled }) => {
          const panel = [...document.querySelectorAll('.tab-panel')].find((p) => p.offsetParent !== null)
          if (!panel) return false
          const drawn = [...panel.querySelectorAll('.chart-canvas')].filter((c) => {
            const cv = c.querySelector('canvas')
            const rows = c.parentElement?.querySelectorAll('.chart-table tbody tr').length ?? 0
            return c.offsetParent !== null && cv && cv.width > 0 && rows > 0
          })
          return drawn.length >= charts && filled.every((sel) => document.querySelector(sel)?.children.length > 0)
        },
        { charts, filled },
        { timeout },
      )
      const end = Date.now() + timeout
      while (state.pending > 0 || Date.now() - state.lastDone < 750) {
        if (Date.now() > end) throw new Error(`${state.pending} data request(s) still in flight`)
        await page.waitForTimeout(100)
      }
      // Let entrance animations (≤ ~1 s) finish so axe sees final colours.
      await page.waitForTimeout(1200)
    },
    /**
     * Visible pointer targets smaller than HOUSE-STYLE §5.5 allows under `(hover: none)`:
     * 40 px (44 px for close buttons) in each dimension. Links inside running text are exempt
     * (WCAG 2.5.5 "inline"). Returns "selector WxH" strings; empty when the rule does not apply.
     */
    async smallTargets() {
      return page.evaluate(() => {
        if (!matchMedia('(hover: none)').matches) return []
        const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=option], [tabindex]:not([tabindex="-1"])'
        const out = []
        for (const el of document.querySelectorAll(sel)) {
          if (el.closest('.sr-only, [hidden], [inert]') || el.matches('.mco-skip-link')) continue
          // Kit-owned map chrome: mco-web-style 0.7.1 leaves these < 40 px under (hover: none). Kept as an
          // exemption by user decision (no kit issue; MIGRATION-MATRIX "Decisions (W4)").
          if (el.matches('.maplibregl-ctrl-group button, .maplibregl-ctrl-attrib-button, .mco-panel-toggle')) continue
          const r = el.getBoundingClientRect()
          const cs = getComputedStyle(el)
          if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue
          // Inline links in prose, and controls wrapped by a label that is itself the target.
          if (el.matches('a') && cs.display === 'inline' && el.closest('p, li, td, figcaption, small')) continue
          const label = el.closest('label')
          const box = label && label.contains(el) ? label.getBoundingClientRect() : r
          const min = el.matches('.modal-close, [aria-label^="Close"], [aria-label^="Dismiss"]') ? 44 : 40
          if (Math.round(box.width) < min || Math.round(box.height) < min) {
            const id = el.id ? '#' + el.id : el.dataset.testid ? `[data-testid=${el.dataset.testid}]` : ''
            const name = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)
            out.push(`${el.tagName.toLowerCase()}${id}.${[...el.classList].join('.')} "${name}" ${Math.round(box.width)}x${Math.round(box.height)}`)
          }
        }
        return out
      })
    },
    /** Console + page errors and CSP violations so far. */
    async problems() {
      const csp = await page.evaluate(() => window.__csp).catch(() => [])
      return [...errors, ...csp.map((c) => `csp: ${c}`)]
    },
  }
}

/* ── Shared steps ───────────────────────────────────────────────────────── */

/** Downloader with a small daily request ready to run (acebozem, Sept 2026). */
export const DL_QUERY = '?s=acebozem&els=air_temp,ppt&period=daily&dl_from=2026-09-01&dl_to=2026-09-30#downloader'

/** Click Run Request once the form allows it (station confirmed, elements loaded); on phones, Next to the Run step first. */
export async function runDownload(page) {
  await page.waitForFunction(() => document.querySelector('[data-testid="dl-run"]')?.disabled === false, null, { timeout: 30000 })
  const next = page.getByTestId('dl-next')
  for (let i = 0; i < 2 && (await next.isVisible()); i++) await next.click()
  await page.getByTestId('dl-run').click()
}

/* ── Reporting ──────────────────────────────────────────────────────────── */

let failures = 0
/** Print one check result; failures make `finish()` exit non-zero. */
export function check(label, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ' — ' + detail}`)
  if (!ok) failures++
}

/** Fail on unfixtured requests, print the summary and exit. */
export function finish(name) {
  if (!RECORD) check(`${name}: every third-party request served from fixtures`, unfixtured.size === 0, [...unfixtured].slice(0, 5).join(' | '))
  console.log(failures === 0 ? `${name}: ALL CHECKS PASSED` : `${name}: ${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
