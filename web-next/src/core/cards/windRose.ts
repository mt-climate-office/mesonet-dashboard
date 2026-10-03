/**
 * The Now wind rose's request: a fixed recent window, legacy's default Latest
 * view (the 14 days to today, hourly; app/mdb/layout.py start-date), wind
 * speed + direction only. It ignores the URL's `from`/`to`/`agg`, which the
 * Charts variable page and Compare write.
 */
import type { RecordQuery } from '../api'
import { chartWindow } from '../models/timeseries'

export interface WindRoseRequest {
  /** `$store.data` key; encodes every input of `query`. */
  key: string
  query: RecordQuery
}

/** Request for `station`: hourly wind over the 14 days ending today (local dates). */
export function windRoseRequest(station: string, today?: Parameters<typeof chartWindow>[2]): WindRoseRequest {
  const w = chartWindow(null, null, today)
  const elements = 'wind_spd,wind_dir'
  return {
    key: `obs:${station}:hourly:${w.start}:${w.end}:${elements}:rmna`,
    query: { station, start: w.start, end: w.end, period: 'hourly', elements, rmNa: true, publicOnly: true },
  }
}
