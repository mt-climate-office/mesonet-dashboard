/**
 * NWS forecasts from api.weather.gov: the text periods (moved out of
 * web/src/hooks/useForecast.ts) and the hourly forecast behind the Now 48 h
 * strip. The Ag GDD projection uses the gridpoint fetcher in
 * core/ag/data/forecast.ts instead.
 */
import { parseWallClock } from '../sensorEvents'
import { HttpError, timedFetch } from './http'

export interface ForecastPeriod {
  number: number
  name: string
  startTime: string
  endTime: string
  isDaytime: boolean
  temperature: number
  temperatureUnit: string
  windSpeed: string
  windDirection: string
  icon: string
  shortForecast: string
  detailedForecast: string
  probabilityOfPrecipitation?: { value: number | null; unitCode: string }
}

export interface NwsForecast {
  /** "Bozeman, MT", or null when NWS gives no relative location. */
  location: string | null
  periods: ForecastPeriod[]
  /** The point's `forecastHourly` URL (for `fetchNwsHourly`), or null when NWS gives none. */
  hourlyUrl: string | null
}

interface PointsResponse {
  properties?: { forecast?: string; forecastHourly?: string; relativeLocation?: { properties?: { city?: string; state?: string } } }
}

interface ForecastResponse {
  properties?: { periods?: ForecastPeriod[] }
}

const NWS = 'https://api.weather.gov'

/** True for an https://api.weather.gov/ URL: the only NWS host fetched or shown (the CSP allows no other). */
export const isNwsUrl = (url: unknown): url is string => typeof url === 'string' && url.startsWith(`${NWS}/`)

/** GET GeoJSON from api.weather.gov; any other URL (one a response pointed to) throws before fetching. */
async function getGeoJson<T>(url: string): Promise<T> {
  if (!isNwsUrl(url)) throw new Error(`NWS URL is not on api.weather.gov: ${url}`)
  return timedFetch(url, { headers: { Accept: 'application/geo+json' } }, async (r) => {
    if (!r.ok) throw new HttpError(r.status, url, await r.text().catch(() => ''))
    return (await r.json()) as T
  })
}

/**
 * Forecast periods for a point (decimal degrees). Two steps: `/points` finds
 * the forecast URL, then that URL is fetched (only on api.weather.gov,
 * `isNwsUrl`). Throws `HttpError` on non-2xx (a 404 means the point is
 * outside NWS coverage).
 */
export async function fetchNwsForecast(latitude: number, longitude: number): Promise<NwsForecast> {
  const points = await getGeoJson<PointsResponse>(`${NWS}/points/${latitude},${longitude}`)
  const forecastUrl = points.properties?.forecast
  if (!forecastUrl) throw new Error('NWS /points response missing forecast URL')
  const fc = await getGeoJson<ForecastResponse>(forecastUrl)
  const loc = points.properties?.relativeLocation?.properties
  return {
    location: loc?.city && loc?.state ? `${loc.city}, ${loc.state}` : null,
    periods: fc.properties?.periods ?? [],
    hourlyUrl: points.properties?.forecastHourly ?? null,
  }
}

/** One hour of the NWS hourly forecast. */
export interface HourlyForecastPoint {
  /** Start of the hour, Denver wall-clock ms (the stamp's local reading; see core/sensorEvents). */
  t: number
  tempF: number
  isDaytime: boolean
  shortForecast: string
  /** Chance of precipitation, %, or null. */
  pop: number | null
}

/** A temperature as NWS sends it: a number + `temperatureUnit`, or a `{unitCode, value}` quantity. */
type NwsTemp = number | { unitCode?: string; value: number | null } | null | undefined

interface HourlyResponse {
  properties?: {
    periods?: {
      startTime?: string
      isDaytime?: boolean
      temperature?: NwsTemp
      temperatureUnit?: string
      shortForecast?: string
      probabilityOfPrecipitation?: { value: number | null } | null
    }[]
  }
}

/** °F from an NWS temperature; null when missing. "C" units and `degC` quantities convert. */
function tempF(t: NwsTemp, unit: string | undefined): number | null {
  const [v, celsius] = typeof t === 'number' ? [t, unit === 'C'] : [t?.value ?? null, /degC/i.test(t?.unitCode ?? '')]
  if (v === null || !Number.isFinite(v)) return null
  return celsius ? (v * 9) / 5 + 32 : v
}

/**
 * Hourly forecast JSON → points in time order. NWS stamps carry the
 * point's local offset (Mountain for Montana), so the wall-clock reading is
 * Denver time. Hours without a start time or temperature are dropped.
 */
export function parseNwsHourly(json: unknown): HourlyForecastPoint[] {
  const out: HourlyForecastPoint[] = []
  for (const p of (json as HourlyResponse | null)?.properties?.periods ?? []) {
    const t = parseWallClock(p.startTime)
    const f = tempF(p.temperature, p.temperatureUnit)
    if (t === null || f === null) continue
    const pop = p.probabilityOfPrecipitation?.value
    out.push({ t, tempF: f, isDaytime: p.isDaytime === true, shortForecast: p.shortForecast ?? '', pop: typeof pop === 'number' ? pop : null })
  }
  return out.sort((a, b) => a.t - b.t)
}

/**
 * Fetch and parse a `forecastHourly` URL (from `NwsForecast.hourlyUrl`).
 * Only api.weather.gov URLs are fetched (`isNwsUrl`). Throws `HttpError` on non-2xx.
 */
export async function fetchNwsHourly(url: string): Promise<HourlyForecastPoint[]> {
  return parseNwsHourly(await getGeoJson<unknown>(url))
}
