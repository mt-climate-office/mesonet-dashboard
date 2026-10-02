/**
 * Weather Forecast card view model: NWS forecast periods → the short cards the
 * component renders as text (never HTML), plus the NWS detail-page link.
 */
import type { ForecastPeriod, NwsForecast } from '../api'

/** Periods shown (web/ ForecastCard: the next 8, about four days). */
export const FORECAST_PERIODS = 8

export interface ForecastCardRow {
  key: number
  name: string
  /** NWS icon URL, only when it is an https api.weather.gov image (the page CSP allows no other host). */
  icon: string | null
  /** Icon alt text: the short forecast. */
  alt: string
  /** "52°F". */
  temp: string
  short: string
  /** Full text, shown as the card's title / tooltip. */
  detail: string
  /** "30%" when the chance of precipitation is above 0, else null. */
  precip: string | null
  isDaytime: boolean
}

const ICON_HOST = /^https:\/\/api\.weather\.gov\//

/** One card per period, first `FORECAST_PERIODS` only. */
export function forecastRows(periods: readonly ForecastPeriod[]): ForecastCardRow[] {
  return periods.slice(0, FORECAST_PERIODS).map((p) => {
    const pop = p.probabilityOfPrecipitation?.value
    return {
      key: p.number,
      name: p.name,
      icon: typeof p.icon === 'string' && ICON_HOST.test(p.icon) ? p.icon : null,
      alt: p.shortForecast,
      temp: `${p.temperature}°${p.temperatureUnit}`,
      short: p.shortForecast,
      detail: p.detailedForecast,
      precip: typeof pop === 'number' && pop > 0 ? `${pop}%` : null,
      isDaytime: p.isDaytime,
    }
  })
}

/** Header text: "{NWS place} · NWS forecast", falling back to the station name. */
export const forecastHeading = (fc: NwsForecast | undefined, stationName: string): string =>
  `${fc?.location ?? stationName} · NWS forecast`

/** NWS point-forecast page (decimal degrees). */
export const forecastDetailUrl = (lat: number, lon: number): string =>
  `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`
