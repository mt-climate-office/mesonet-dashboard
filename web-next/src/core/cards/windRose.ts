/**
 * The Wind Rose card's request: the main plot's window (`?from`/`?to`,
 * default 14 days to today) and aggregation (`?agg`), wind speed + direction
 * only, as web/ WindRoseCard (legacy builds it from the plotted record).
 */
import type { RecordQuery } from '../api'
import { chartWindow } from '../models/timeseries'
import type { LatestAgg } from '../url-schema'

export interface WindRoseRequest {
  /** `$store.data` key; encodes every input of `query`. */
  key: string
  query: RecordQuery
}

/** Request for `station` over the plotted window, or null when the window is invalid. */
export function windRoseRequest(
  station: string,
  from: string | null,
  to: string | null,
  agg: LatestAgg,
  today?: Parameters<typeof chartWindow>[2],
): WindRoseRequest | null {
  const w = chartWindow(from, to, today)
  if (!w.valid) return null
  const elements = 'wind_spd,wind_dir'
  return {
    key: `obs:${station}:${agg}:${w.start}:${w.end}:${elements}:rmna`,
    query: { station, start: w.start, end: w.end, period: agg, elements, rmNa: true, publicOnly: true },
  }
}
