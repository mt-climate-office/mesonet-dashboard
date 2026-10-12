/**
 * Hybrid static-data sourcing: try the data2 CDN first (short timeout), fall
 * back to the copy vendored under `public/data/`.
 *
 * data2 is S3 + CloudFront behind an SPA: some missing keys return 404 XML,
 * others return **200 text/html** (the data-browser shell). Responses are
 * therefore validated by content type and shape, never by status alone.
 */

export const DATA2_BASE = 'https://data2.climate.umt.edu/mesonet/'
/** mesonet-soils' single published contract (same shape as the vendored `soil_params.json`). */
export const DATA2_SOIL_PARAMS = `${DATA2_BASE}soils/soil_params.json`
export const DATA2_GDD_STAGES = `${DATA2_BASE}derived/gdd_stages.json`
export const DATA2_TIMEOUT_MS = 2500

/** Whether `loadSoilParams` probes data2 (mesonet-soils publishes `soils/soil_params.json`). */
export const DATA2_SOILS_ENABLED = true

/**
 * Whether `loadGddStages` probes data2. data2 does not publish
 * `derived/gdd_stages.json` yet, so every probe would be a console 404 before
 * the vendored fallback; flip this to `true` once it does. The data2 path
 * stays tested (`deps.data2Enabled` / `deps.only = 'data2'`).
 */
export const DATA2_GDD_ENABLED = false

export type StaticSource = 'data2' | 'vendored'

/** Injected for tests / Node; defaults to the global fetch. */
export interface StaticDeps {
  fetchImpl?: typeof fetch
  /** Base URL of the vendored files (default `${BASE_URL}data/`). */
  vendoredBase?: string
  timeoutMs?: number
  /** Skip one source (testing / diagnostics). */
  only?: StaticSource
  /** Override the loader's `DATA2_*_ENABLED` flag for the default (data2 → vendored) order. */
  data2Enabled?: boolean
}

export function data2Enabled(deps: StaticDeps | undefined, enabled: boolean): boolean {
  return deps?.data2Enabled ?? enabled
}

export function vendoredBase(deps?: StaticDeps): string {
  if (deps?.vendoredBase) return deps.vendoredBase
  const base = import.meta.env?.BASE_URL ?? '/'
  return `${base.replace(/\/?$/, '/')}data/`
}

export class StaticFetchError extends Error {
  constructor(url: string, reason: string) {
    super(`${url}: ${reason}`)
    this.name = 'StaticFetchError'
  }
}

/** GET with a timeout; rejects on non-2xx or an HTML body (SPA fallback). */
export async function getText(
  url: string,
  deps: StaticDeps = {},
  timeoutMs?: number,
): Promise<string> {
  const f = deps.fetchImpl ?? fetch
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const ms = timeoutMs ?? deps.timeoutMs
  const timer = ctrl && ms ? setTimeout(() => ctrl.abort(), ms) : null
  try {
    const r = await f(url, ctrl ? { signal: ctrl.signal } : undefined)
    if (!r.ok) throw new StaticFetchError(url, `HTTP ${r.status}`)
    const type = r.headers.get('content-type') ?? ''
    const text = await r.text()
    if (/text\/html/i.test(type) || /^\s*<(!doctype|html|\?xml)/i.test(text)) {
      throw new StaticFetchError(url, `unexpected ${type || 'markup'} body`)
    }
    return text
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function getJson<T>(url: string, deps?: StaticDeps, timeoutMs?: number): Promise<T> {
  const text = await getText(url, deps, timeoutMs)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new StaticFetchError(url, 'invalid JSON')
  }
}
