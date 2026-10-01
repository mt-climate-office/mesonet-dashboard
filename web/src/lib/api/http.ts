/**
 * Low-level HTTP helpers for the Mesonet v2 API. Everything that talks to
 * `API_URL` goes through `buildUrl` + one of the fetchers here, so a param
 * allowlist or instrumentation can be added in one place.
 */
import { API_URL } from '../config'
import { buildQuery, parseCsv } from '../csv'
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

/** Absolute API URL for `path` (leading slash optional) plus encoded query. */
export function buildUrl(path: string, query: Record<string, unknown> = {}): string {
  return `${API_URL}${path.replace(/^\//, '')}${buildQuery(query as never)}`
}

export async function fetchText(
  path: string,
  query: Record<string, unknown> = {},
): Promise<string> {
  const url = buildUrl(path, query)
  const r = await fetch(url, { headers: { Accept: 'text/csv,application/json' } })
  if (!r.ok) {
    throw new HttpError(r.status, url, await r.text().catch(() => ''))
  }
  return r.text()
}

export async function fetchJson<T>(
  path: string,
  query: Record<string, unknown> = {},
): Promise<T> {
  const url = buildUrl(path, query)
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) {
    throw new HttpError(r.status, url, await r.text().catch(() => ''))
  }
  return (await r.json()) as T
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
