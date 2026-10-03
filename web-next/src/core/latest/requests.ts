/**
 * Cache keys and request shapes for the Latest timeseries, so every caller
 * of `$store.data.cached` builds the same key from the same inputs.
 */
import type { RecordQuery } from '../api'
import { requestElements, type WindowPlan } from '../models/timeseries'
import { denverToday } from '../today'
import type { LatestAgg } from '../url-schema'

type ElementRow = { element: string; description_short: string }

const HOUR = 3_600_000

/** TTLs from ARCHITECTURE.md (former TanStack hooks). */
export const TTL = { elements: HOUR, config: HOUR / 2, normals: Infinity, record: 5 * 60_000 } as const

export const elementsKey = (station: string): string => `elements:${station}`
export const configKey = (station: string): string => `config:${station}`
export const normalsKey = (station: string, variable: string): string => `normals:${station}:${variable}`

export interface RecordRequest {
  key: string
  query: RecordQuery
}

/**
 * The observation request for the plot: QC level 2 (core/api default),
 * `rm_na=false` so gaps stay null, public elements, inclusive `end` (core/api
 * sends end + 1 day). Null when there is nothing to ask for. `extremes`
 * (daily only) asks for each day's minimum and maximum instead of the mean,
 * without Reference ET (a total has no band).
 */
export function recordRequest(i: {
  station: string
  window: WindowPlan
  agg: LatestAgg
  vars: readonly string[]
  stationElements?: readonly ElementRow[]
  extremes?: boolean
}): RecordRequest | null {
  if (!i.window.valid || i.vars.length === 0) return null
  const req = requestElements(i.vars, i.stationElements)
  const { elements } = req
  const hasEtr = req.hasEtr && !i.extremes
  if (!elements && !hasEtr) return null
  const ext = i.extremes && i.agg === 'daily'
  return {
    key: `obs:${i.station}:${i.agg}:${i.window.start}:${i.window.end}:${elements}:${hasEtr ? 'etr' : ''}${ext ? ':minmax' : ''}`,
    query: {
      ...(ext ? { aggFunc: ['min', 'max'] as const } : {}),
      station: i.station,
      start: i.window.start,
      end: i.window.end,
      period: i.agg,
      elements,
      hasEtr,
      rmNa: false,
      publicOnly: true,
    },
  }
}

/** The window reaches today (Denver; open-ended counts): its data still grows, so the read is live (core/cache). */
export const endsToday = (r: RecordRequest, today: string = denverToday()): boolean => typeof r.query.end !== 'string' || r.query.end >= today
