/**
 * The Now overview's fetches beyond the shared Latest ones
 * (ui/station/resources.ts: latest obs, ppt summary, NWS, photos):
 * the one 72 h hourly request for the sparklines and the normals CSVs.
 * Both are tier 2: callers ask only once `/latest` has arrived.
 */
import Alpine from 'alpinejs'
import { getStationRecord, type ObservationRow } from '../../core/api'
import type { Resource } from '../../core/cache'
import { fetchDailyNormals, type NormalRow } from '../../core/normals'
import { sparkQuery } from '../../core/overview'

const MIN = 60_000

/** Hourly rows for every sparkline (core/overview `sparkQuery`). */
export function sparkRows(station: string, today: string, latest: Record<string, unknown>): Resource<ObservationRow[]> {
  const q = sparkQuery(station, today, latest)
  return Alpine.store('data').cached(q.key, () => getStationRecord(q.query), { ttl: 5 * MIN })
}

/** One gridMET normals CSV (`tmmx`, `tmmn`, `pr`); never stale. */
export const normals = (station: string, code: 'tmmx' | 'tmmn' | 'pr'): Resource<NormalRow[]> =>
  Alpine.store('data').cached(`normals:${station}:${code}`, () => fetchDailyNormals(station, code), { ttl: Infinity })
