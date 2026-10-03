/**
 * NWS gridpoint forecast → contract `ForecastDaily` (≤ 7 local days of
 * min/max air temperature, °C) for the GDD projection.
 *
 * Two requests, like `hooks/useForecast.ts`: `/points/{lat},{lon}` →
 * `properties.forecastGridData`, then the gridpoint document, whose
 * `minTemperature` / `maxTemperature` series carry ISO-8601 interval
 * `validTime`s ("2026-10-02T02:00:00+00:00/PT14H"). Each value is assigned
 * to the America/Denver date of its interval midpoint (overnight lows land
 * on the morning they occur; daytime highs on their own day).
 *
 * Failures (NWS 5xx, 403, 429 rate limits, timeouts, malformed JSON) do not
 * throw: they return `{ status: 'degraded' }` so the projection can fall
 * back to normals.
 */
import type { ForecastDaily, LocalDate, Nullable } from '../contract'
import { denverToday } from '../../today'
import { denverLocal } from './parse'

export const NWS_BASE = 'https://api.weather.gov'
export const FORECAST_MAX_DAYS = 7

export type ForecastResult =
  | { status: 'ok'; forecast: ForecastDaily }
  | { status: 'degraded'; reason: string; httpStatus?: number }

interface GridValue {
  validTime: string
  value: number | null
}

interface GridSeries {
  uom?: string
  values?: GridValue[]
}

export interface GridpointDoc {
  properties?: {
    updateTime?: string
    minTemperature?: GridSeries
    maxTemperature?: GridSeries
  }
}

/** Parse an ISO-8601 duration like `PT14H`, `P1DT6H`, `PT30M` → ms. */
export function durationMs(d: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(d)
  if (!m) return 0
  const [, D, H, M, S] = m.map((x) => (x ? Number(x) : 0))
  return ((D * 24 + H) * 60 + M) * 60_000 + S * 1000
}

const toC = (uom: string | undefined, v: number) =>
  uom && /degF/i.test(uom) ? ((v - 32) * 5) / 9 : v

function byLocalDate(series: GridSeries | undefined, reduce: 'min' | 'max') {
  const out = new Map<LocalDate, number>()
  for (const { validTime, value } of series?.values ?? []) {
    if (value === null || value === undefined || !Number.isFinite(value)) continue
    const [startIso, dur] = validTime.split('/')
    const start = Date.parse(startIso)
    if (Number.isNaN(start)) continue
    const mid = start + durationMs(dur ?? '') / 2
    const date = denverLocal(mid).date
    const c = toC(series?.uom, value)
    const prev = out.get(date)
    out.set(date, prev === undefined ? c : reduce === 'min' ? Math.min(prev, c) : Math.max(prev, c))
  }
  return out
}

/** Gridpoint JSON → ForecastDaily: dates ≥ today (Denver), at most 7. */
export function parseGridpointDaily(doc: GridpointDoc, now: number = Date.now()): ForecastDaily {
  const mins = byLocalDate(doc.properties?.minTemperature, 'min')
  const maxs = byLocalDate(doc.properties?.maxTemperature, 'max')
  const today = denverToday(now)
  const dates = [...new Set([...mins.keys(), ...maxs.keys()])]
    .filter((d) => d >= today)
    .sort()
    .slice(0, FORECAST_MAX_DAYS)
  const pick = (m: Map<LocalDate, number>, d: LocalDate): Nullable => m.get(d) ?? null
  return {
    date: dates,
    tminC: dates.map((d) => pick(mins, d)),
    tmaxC: dates.map((d) => pick(maxs, d)),
    source: 'nws',
    issued: doc.properties?.updateTime,
  }
}

async function getNws<T>(url: string, f: typeof fetch, signal?: AbortSignal): Promise<T> {
  const r = await f(url, { headers: { Accept: 'application/geo+json' }, signal })
  if (!r.ok) {
    const err = new Error(`NWS ${r.status} on ${url}`) as Error & { httpStatus?: number }
    err.httpStatus = r.status
    throw err
  }
  return (await r.json()) as T
}

export async function fetchForecastDaily(
  lat: number,
  lon: number,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; now?: number } = {},
): Promise<ForecastResult> {
  const f = opts.fetchImpl ?? fetch
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000)
  try {
    const pt = `${Number(lat.toFixed(4))},${Number(lon.toFixed(4))}`
    const points = await getNws<{ properties?: { forecastGridData?: string } }>(
      `${NWS_BASE}/points/${pt}`,
      f,
      ctrl.signal,
    )
    const gridUrl = points.properties?.forecastGridData
    if (!gridUrl) return { status: 'degraded', reason: 'NWS /points missing forecastGridData' }
    const grid = await getNws<GridpointDoc>(gridUrl, f, ctrl.signal)
    const forecast = parseGridpointDaily(grid, opts.now)
    if (forecast.date.length === 0) {
      return { status: 'degraded', reason: 'NWS gridpoint has no current min/max temperatures' }
    }
    return { status: 'ok', forecast }
  } catch (err) {
    const e = err as Error & { httpStatus?: number }
    return {
      status: 'degraded',
      reason: e.name === 'AbortError' ? 'NWS request timed out' : e.message,
      httpStatus: e.httpStatus,
    }
  } finally {
    clearTimeout(timer)
  }
}
