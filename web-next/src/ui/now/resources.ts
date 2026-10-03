/**
 * The Now page's fetches beyond the shared ones (ui/station/resources.ts:
 * latest obs, ppt summary, NWS periods, photos), all tier 2: callers ask
 * only once `/latest` (or, for the hourly forecast, the NWS periods) is in.
 * The 72 h hourly rows (sparklines, strip, pressure trend), the normals
 * CSVs, the NWS hourly forecast and the soil water potential for the chip.
 */
import Alpine from 'alpinejs'
import { fetchCsv, fetchNwsHourly, getStationRecord, type HourlyForecastPoint, type ObservationRow } from '../../core/api'
import type { Resource } from '../../core/cache'
import { fetchDailyNormals, type NormalRow } from '../../core/normals'
import { nowSwpQuery, sparkQuery } from '../../core/overview'

const MIN = 60_000

/** Hourly rows for every sparkline and the strip (core/overview `sparkQuery`). */
export function sparkRows(station: string, today: string, latest: Record<string, unknown>): Resource<ObservationRow[]> {
  const q = sparkQuery(station, today, latest)
  return Alpine.store('data').cached(q.key, () => getStationRecord(q.query), { ttl: 5 * MIN })
}

/** One gridMET normals CSV (`tmmx`, `tmmn`, `pr`); never stale. */
export const normals = (station: string, code: 'tmmx' | 'tmmn' | 'pr'): Resource<NormalRow[]> =>
  Alpine.store('data').cached(`normals:${station}:${code}`, () => fetchDailyNormals(station, code), { ttl: Infinity })

/** NWS hourly forecast from the point's `forecastHourly` URL. */
export const nwsHourly = (url: string): Resource<HourlyForecastPoint[]> =>
  Alpine.store('data').cached(`nwsh:${url}`, () => fetchNwsHourly(url), { ttl: 30 * MIN })

/** Recent hourly soil water potential (core/overview `nowSwpQuery`); only for stations with SWP sensors. */
export function swpRows(station: string, today: string): Resource<ObservationRow[]> {
  const q = nowSwpQuery(station, today)
  return Alpine.store('data').cached(q.key, () => fetchCsv<ObservationRow>(q.request.path, q.request.query), { ttl: 30 * MIN })
}
