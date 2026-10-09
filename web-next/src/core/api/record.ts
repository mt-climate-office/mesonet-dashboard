/** Station time-series records (`/observations/*` + derived ETr joins). */
import type { AggPeriod } from '../params'
import { DERIVED_ENDPOINTS, ENDPOINTS } from '../params'
import { fetchCsv, mergeOn } from './http'
import type { ObservationRow } from './types'

export interface RecordQuery {
  station: string
  start: Date | string
  end?: Date | string
  period: AggPeriod
  /** comma-separated element codes; defaults to a sensible station-default set */
  elements?: string
  hasEtr?: boolean
  derivedElems?: string[]
  rmNa?: boolean
  naInfo?: boolean
  publicOnly?: boolean
  /** API QC tier: 0 raw, 1 provisional, 2 quality-controlled (default). */
  level?: 0 | 1 | 2
  /**
   * Daily only: one column per element per function instead of the daily mean
   * ("Minimum Air Temperature @ 2 m [°F]", "Maximum …"); the API pairs each
   * `agg_func` entry with the `elements` entry at the same position.
   */
  aggFunc?: readonly ('min' | 'max')[]
  /** Soil depths also as one series per sensor array (`split_arrays`; "… (probe A) …" columns beside the combined one). */
  splitArrays?: boolean
}

/** `elements` and `agg_func` for `aggFunc` over comma-separated `elements` (each code once per function). */
export function aggFuncQuery(elements: string, funcs: readonly string[]): { elements: string; agg_func: string } {
  const codes = elements.split(',').filter(Boolean)
  return { elements: funcs.flatMap(() => codes).join(','), agg_func: funcs.flatMap((f) => codes.map(() => f)).join(',') }
}

export const fmtDate = (d: Date | string): string =>
  typeof d === 'string' ? d : d.toISOString().slice(0, 10)

/**
 * The v2 API treats `end_time` as an exclusive cutoff (a bare date means
 * midnight at the start of that day). The UI's end dates are inclusive, so
 * shift them forward one day before sending.
 */
export function exclusiveEnd(d: Date | string): string {
  const [y, m, day] = fmtDate(d).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day + 1)).toISOString().slice(0, 10)
}

/**
 * Mirrors get_data.get_station_record. Returns the time series CSV joined with
 * derived elements (e.g. etr) when has_etr / derived_elems are set.
 */
export async function getStationRecord(q: RecordQuery): Promise<ObservationRow[]> {
  const start = fmtDate(q.start)
  const end = q.end ? exclusiveEnd(q.end) : undefined

  // Quality-controlled (level 2) by default. The legacy dashboard used
  // level 1, which passes through flatlined sensors and false precip spikes
  // (see mesonet-db-rds#189).
  const derivedQuery = {
    stations: q.station,
    elements: q.elements ?? '',
    start_time: start,
    end_time: end,
    level: q.level ?? 2,
    rm_na: q.rmNa ?? true,
    na_info: q.naInfo ?? false,
  }
  // /derived/* has no `public` parameter; observations do. Raw
  // `/observations/` has no `na_info` (only the hourly/daily aggregates do).
  const { na_info, ...noNaInfo } = derivedQuery
  const baseQuery = {
    ...(q.period === 'raw' ? noNaInfo : { ...noNaInfo, na_info }),
    public: q.publicOnly ?? true,
    ...(q.aggFunc?.length && q.elements ? aggFuncQuery(q.elements, q.aggFunc) : {}),
    ...(q.splitArrays ? { split_arrays: true } : {}),
  }

  const observations =
    q.elements && q.elements !== ''
      ? await fetchCsv<ObservationRow>(ENDPOINTS[q.period], baseQuery)
      : []

  let merged = observations

  // ETr rides along with the observations; if the derived call fails, keep
  // the observations rather than failing the whole record.
  if (q.hasEtr) {
    try {
      const etr = await fetchCsv<ObservationRow>(DERIVED_ENDPOINTS[q.period], {
        ...derivedQuery,
        elements: 'etr',
      })
      merged = mergeOn(merged, etr, ['station', 'datetime'])
    } catch (err) {
      if (observations.length === 0) throw err
      console.warn('Reference ET request failed; showing observations only.', err)
    }
  }

  if (q.derivedElems && q.derivedElems.length > 0) {
    const derived = await fetchCsv<ObservationRow>(DERIVED_ENDPOINTS[q.period], {
      ...derivedQuery,
      elements: q.derivedElems.join(','),
    })
    merged = mergeOn(merged, derived, ['station', 'datetime'])
  }

  return merged
}
