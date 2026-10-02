/**
 * NWS text forecast for the Latest tab's Forecast card (api.weather.gov),
 * moved out of web/src/hooks/useForecast.ts. The Ag GDD projection uses the
 * gridpoint fetcher in core/ag/data/forecast.ts instead.
 */
import { HttpError } from './http'

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
}

interface PointsResponse {
  properties?: { forecast?: string; relativeLocation?: { properties?: { city?: string; state?: string } } }
}

interface ForecastResponse {
  properties?: { periods?: ForecastPeriod[] }
}

const NWS = 'https://api.weather.gov'

async function getGeoJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/geo+json' } })
  if (!r.ok) throw new HttpError(r.status, url, await r.text().catch(() => ''))
  return (await r.json()) as T
}

/**
 * Forecast periods for a point (decimal degrees). Two steps: `/points` finds
 * the forecast URL, then that URL is fetched. Throws `HttpError` on non-2xx
 * (a 404 means the point is outside NWS coverage).
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
  }
}
