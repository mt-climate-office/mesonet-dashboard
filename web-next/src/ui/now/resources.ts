/**
 * The Now page's fetches beyond the shared ones (ui/station/resources.ts:
 * latest obs, ppt summary, NWS periods, photos), all tier 2: callers ask
 * only once `/latest` (or, for the hourly forecast, the NWS periods) is in.
 * The 72 h hourly rows (sparklines, strip, pressure trend), the normals
 * CSVs, the NWS hourly forecast, the soil VWC behind the chip's SWP and
 * the 7 daily precipitation totals for the Rain tile. All but the normals are
 * live (re-read on the freshness tick); those keyed by today's date keep a
 * slot, so the midnight rollover shows the last rows while the new ones load.
 */
import Alpine from 'alpinejs'
import { fetchSoilSeries } from '../../core/ag/data'
import type { SoilSeries } from '../../core/ag/contract'
import { fetchNwsHourly, getStationRecord, type HourlyForecastPoint, type ObservationRow } from '../../core/api'
import type { Resource } from '../../core/cache'
import { fetchDailyNormals, type NormalRow } from '../../core/normals'
import { nowSwpQuery, rainDailyQuery, sparkQuery } from '../../core/overview'

const MIN = 60_000

/** Hourly rows for every sparkline and the strip (core/overview `sparkQuery`). */
export function sparkRows(station: string, today: string, latest: Record<string, unknown>): Resource<ObservationRow[]> {
  const q = sparkQuery(station, today, latest)
  return Alpine.store('data').cached(q.key, () => getStationRecord(q.query), { ttl: 5 * MIN, live: true, slot: `spark:${station}` })
}

/** One gridMET normals CSV (`tmmx`, `tmmn`, `pr`); never stale. */
export const normals = (station: string, code: 'tmmx' | 'tmmn' | 'pr'): Resource<NormalRow[]> =>
  Alpine.store('data').cached(`normals:${station}:${code}`, () => fetchDailyNormals(station, code), { ttl: Infinity })

/** NWS hourly forecast from the point's `forecastHourly` URL. */
export const nwsHourly = (url: string): Resource<HourlyForecastPoint[]> =>
  Alpine.store('data').cached(`nwsh:${url}`, () => fetchNwsHourly(url), { ttl: 30 * MIN, live: true })

/** Recent hourly soil VWC for the soil chip's SWP (core/overview `nowSwpQuery`); only for stations with SWP parameters. */
export function swpSoil(station: string, today: string): Resource<SoilSeries> {
  const q = nowSwpQuery(station, today)
  return Alpine.store('data').cached(q.key, () => fetchSoilSeries(q.query), { ttl: 30 * MIN, live: true, slot: `swp:${station}` })
}

/** The last 7 days' daily precipitation for the Rain tile's bars (core/overview `rainDailyQuery`). */
export function rainDaily(station: string, today: string): Resource<ObservationRow[]> {
  const q = rainDailyQuery(station, today)
  return Alpine.store('data').cached(q.key, () => getStationRecord(q.query), { ttl: 30 * MIN, live: true, slot: `rain:${station}` })
}
