/**
 * Wind rose requests: wind speed + direction only, `rm_na` (a rose has no
 * gaps to draw). Now's card asks for its own fixed window, the last 24 hours
 * at the station's raw interval (5-min, 15-min at AgriMet), whatever the
 * Charts range in the URL; the Wind direction page's Rose view asks for its
 * window at its interval (core/variables/rose).
 */
import type { RecordQuery } from '../api'
import { chartWindow } from '../models/timeseries'
import { denverDay } from '../today'

export interface WindRoseRequest {
  /** `$store.data` key; encodes every input of `query`. */
  key: string
  query: RecordQuery
}

const ELEMENTS = 'wind_spd,wind_dir'

/** Wind for `station` over the inclusive local dates `start`…`end` at `period` (hourly, or raw: the logger's own interval). */
export function windRoseRequest(station: string, start: string, end: string, period: 'hourly' | 'raw'): WindRoseRequest {
  return {
    key: `obs:${station}:${period}:${start}:${end}:${ELEMENTS}:rmna`,
    query: { station, start, end, period, elements: ELEMENTS, rmNa: true, publicOnly: true },
  }
}

/**
 * Now's card: raw readings for yesterday and today (local dates), so the last 24 hours are inside
 * whatever the hour; the card keeps the 24 hours up to the newest reading (core/variables `last24h`).
 */
export function nowWindRoseRequest(station: string, today = denverDay()): WindRoseRequest {
  const w = chartWindow(today.subtract(1, 'day').format('YYYY-MM-DD'), null, today)
  return windRoseRequest(station, w.start, w.end, 'raw')
}
