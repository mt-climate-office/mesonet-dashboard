/**
 * Low-level HTTP helpers for the Mesonet v2 API. Everything that talks to
 * `API_URL` goes through `buildUrl` + one of the fetchers here, so a param
 * allowlist or instrumentation can be added in one place.
 */
import { API_URL } from '../config'
import { buildQuery, parseCsv } from '../csv'
import { PARAM_ALLOWLIST } from './paramAllowlist'
import type { ObservationRow } from './types'

/** Non-2xx response from the API. `status` drives retry decisions. */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, url: string, body: string) {
    super(`HTTP ${status} on ${url}: ${body}`)
    this.name = 'HttpError'
    this.status = status
  }
}

/** How long a request (headers and body) may take before it is abandoned. */
export const REQUEST_TIMEOUT_MS = 30_000

/** A request that took longer than its timeout; retryable (core/api/retry.ts), like a network error. */
export class TimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`No answer in ${ms / 1000} s from ${url}`)
    this.name = 'TimeoutError'
  }
}

/**
 * `fetch(url, init)` and `read` its response, both within `ms`: past it the
 * request is aborted and this throws `TimeoutError`. `read` gets every
 * response (non-2xx included) and decides what to throw.
 */
export async function timedFetch<T>(url: string, init: RequestInit, read: (r: Response) => Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort()
      reject(new TimeoutError(url, ms))
    }, ms)
  })
  try {
    return await Promise.race([fetch(url, { ...init, signal: ctrl.signal }).then(read), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/* -------------------------------------------------------------------------- */
/* Query-param allowlist (generated from the OpenAPI spec; see gen:api)        */
/* -------------------------------------------------------------------------- */

const TEMPLATES = Object.keys(PARAM_ALLOWLIST).map((tpl) => ({
  tpl,
  re: new RegExp(
    `^${tpl
      .replace(/^\/|\/$/g, '')
      .split('/')
      .map((seg) => (/^\{\w+\}$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/')}$`,
  ),
  // Literal segments outrank `{param}` segments when several templates match.
  specificity: tpl.split('/').filter((s) => s && !s.startsWith('{')).length,
}))

/** OpenAPI path template for an app path (`observations/daily` → `/observations/daily/`). */
export function matchEndpoint(path: string): string | null {
  const p = path.split('?')[0].replace(/^\/|\/$/g, '')
  let best: (typeof TEMPLATES)[number] | null = null
  for (const t of TEMPLATES) {
    if (t.re.test(p) && (!best || t.specificity > best.specificity)) best = t
  }
  return best?.tpl ?? null
}

/** Query keys `buildQuery` would actually send (it drops undefined/null/''). */
const sentKeys = (query: Record<string, unknown>) =>
  Object.keys(query).filter((k) => {
    const v = query[k]
    return v !== undefined && v !== null && v !== ''
  })

export interface ParamViolation {
  endpoint: string | null
  unknown: string[]
}

/** Params not allowed for `path` by the spec (or `endpoint: null` if the path is unknown). */
export function checkParams(path: string, query: Record<string, unknown>): ParamViolation | null {
  const endpoint = matchEndpoint(path)
  if (!endpoint) return { endpoint: null, unknown: sentKeys(query) }
  const allowed = PARAM_ALLOWLIST[endpoint]
  const unknown = sentKeys(query).filter((k) => !allowed.includes(k))
  return unknown.length ? { endpoint, unknown } : null
}

/**
 * Enforce the allowlist. Dev (and tests): console.error + throw, so a bad
 * param (the `premade` class of bug) fails loudly. Prod: drop the offending
 * params, warn, and send the rest. Unknown endpoints throw in dev and pass
 * through untouched in prod.
 */
export function enforceAllowlist(
  path: string,
  query: Record<string, unknown>,
  dev: boolean = import.meta.env.DEV,
): Record<string, unknown> {
  const v = checkParams(path, query)
  if (!v) return query
  const msg = v.endpoint
    ? `API param allowlist: ${v.endpoint} does not accept ${v.unknown.join(', ')}`
    : `API param allowlist: unknown endpoint "${path}" (not in openapi.json or HIDDEN routes)`
  if (dev) {
    console.error(msg)
    throw new Error(msg)
  }
  console.warn(`${msg}${v.endpoint ? ' — dropped' : ''}`)
  if (!v.endpoint) return query
  return Object.fromEntries(Object.entries(query).filter(([k]) => !v.unknown.includes(k)))
}

/** Absolute API URL for `path` (leading slash optional) plus encoded query. */
export function buildUrl(path: string, query: Record<string, unknown> = {}): string {
  const q = enforceAllowlist(path, query)
  return `${API_URL}${path.replace(/^\//, '')}${buildQuery(q as never)}`
}

export async function fetchText(
  path: string,
  query: Record<string, unknown> = {},
): Promise<string> {
  const url = buildUrl(path, query)
  return timedFetch(url, { headers: { Accept: 'text/csv,application/json' } }, async (r) => {
    if (!r.ok) throw new HttpError(r.status, url, await r.text().catch(() => ''))
    return r.text()
  })
}

export async function fetchJson<T>(
  path: string,
  query: Record<string, unknown> = {},
): Promise<T> {
  const url = buildUrl(path, query)
  return timedFetch(url, { headers: { Accept: 'application/json' } }, async (r) => {
    if (!r.ok) throw new HttpError(r.status, url, await r.text().catch(() => ''))
    return (await r.json()) as T
  })
}

/** GET `path` with `type=csv` and parse (LAB_SWAP-renamed headers). */
export async function fetchCsv<T extends object>(
  path: string,
  query: Record<string, unknown> = {},
): Promise<T[]> {
  const text = await fetchText(path, { ...query, type: 'csv' })
  return parseCsv<T & Record<string, unknown>>(text) as T[]
}

/**
 * Left-join `right` onto `left` by `keys` (right wins on column conflicts).
 * If either side is empty the other is returned unchanged.
 */
export function mergeOn(
  left: ObservationRow[],
  right: ObservationRow[],
  keys: string[],
): ObservationRow[] {
  if (left.length === 0) return right
  if (right.length === 0) return left
  const index = new Map<string, ObservationRow>()
  for (const row of right) {
    index.set(keys.map((k) => row[k]).join('||'), row)
  }
  return left.map((row) => {
    const match = index.get(keys.map((k) => row[k]).join('||'))
    return match ? { ...row, ...match } : row
  })
}
