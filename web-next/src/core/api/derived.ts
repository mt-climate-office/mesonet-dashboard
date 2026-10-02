/* -------------------------------------------------------------------------- */
/* Ag Tools — /derived (soil water potential only)                            */
/* -------------------------------------------------------------------------- */
/**
 * Every Ag Tools variable is computed client-side from raw observations
 * (`core/ag/compute`) except soil water potential, which stays on the
 * API's `/derived` endpoint (server-side soil parameters) until
 * mesonet-db-rds#186 resolves: the public mesonet-soils fits diverge strongly
 * from the API's at the dry end (DIVERGENCES.md D-SWP-2). The switch lives in
 * `core/ag/view/swpSource.ts` (`SWP_SOURCE`).
 */
import { exclusiveEnd } from './record'

export interface DerivedSwpQuery {
  station: string
  /** Inclusive local start date, YYYY-MM-DD. */
  start: string
  /** Inclusive local end date, YYYY-MM-DD. */
  end: string
  time: 'daily' | 'hourly'
  /** QC level (Ag Tools default: 2). */
  level: 0 | 1 | 2
}

/**
 * `/derived/{daily,hourly}?elements=swp` request (CSV; positive bar
 * magnitudes per depth, columns `Soil Water Potential @ -5 cm [bar]` …).
 * Returned as a request so callers can fetch it with raw (un-renamed)
 * headers.
 */
export function derivedSwpRequest(q: DerivedSwpQuery): {
  path: string
  query: Record<string, string | number | boolean>
} {
  return {
    path: `derived/${q.time}/`,
    query: {
      stations: q.station,
      start_time: q.start,
      end_time: exclusiveEnd(q.end),
      elements: 'swp',
      level: q.level,
    },
  }
}
