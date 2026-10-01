/**
 * Annual (year-over-year) grouping on local dates: split a series into one
 * trace per calendar year keyed by day of year, optionally as a running sum
 * within each year (precipitation, ETo, GDD and other accumulating
 * variables).
 *
 * Day of year is the local (America/Denver) date's own DOY, so in leap years
 * Mar 1 is DOY 61 and Dec 31 is DOY 366. Hourly timestamps are grouped by
 * their local date (the first 10 characters).
 */
import type { LocalDate, LocalDateTime, Nullable } from '../contract'
import { dayOfYear, ok } from './util'

/** Variables summed (not averaged) over time; their annual view is cumulative. */
export const CUMULATIVE_VARIABLES: ReadonlySet<string> = new Set([
  'ppt',
  'precipitation',
  'eto',
  'etr',
  'gdd',
])

export function isCumulativeVariable(name: string): boolean {
  return CUMULATIVE_VARIABLES.has(name.toLowerCase())
}

export interface AnnualTrace {
  year: number
  date: LocalDate[]
  doy: number[]
  values: Nullable[]
}

export interface AnnualOptions {
  /**
   * Running sum within each year, skipping nulls (a null day keeps the
   * previous total; leading nulls stay null). Defaults to false.
   */
  cumulative?: boolean
}

/**
 * Group a daily series by local calendar year. Input rows may be unsorted;
 * each trace is returned in date order, and traces in year order. Duplicate
 * dates keep the last value.
 */
export function groupByYear(
  dates: LocalDate[],
  values: Nullable[],
  opts: AnnualOptions = {},
): AnnualTrace[] {
  const byYear = new Map<number, Map<LocalDate, Nullable>>()
  dates.forEach((d, i) => {
    const y = Number(d.slice(0, 4))
    let m = byYear.get(y)
    if (!m) byYear.set(y, (m = new Map()))
    m.set(d.slice(0, 10), ok(values[i]) ? values[i] : null)
  })
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, m]) => {
      const date = [...m.keys()].sort()
      let vals = date.map((d) => m.get(d) ?? null)
      if (opts.cumulative) {
        let acc: Nullable = null
        vals = vals.map((v) => {
          if (ok(v)) acc = (acc ?? 0) + v
          return acc
        })
      }
      return { year, date, doy: date.map(dayOfYear), values: vals }
    })
}

/**
 * Aggregate an hourly series to local-date daily values (sum or mean of
 * non-null hours; null when a day has no values), for feeding
 * {@link groupByYear}.
 */
export function hourlyToDaily(
  time: LocalDateTime[],
  values: Nullable[],
  how: 'sum' | 'mean',
): { date: LocalDate[]; values: Nullable[] } {
  const acc = new Map<LocalDate, { sum: number; n: number }>()
  time.forEach((t, i) => {
    const d = t.slice(0, 10)
    const a = acc.get(d) ?? { sum: 0, n: 0 }
    const v = values[i]
    if (ok(v)) {
      a.sum += v
      a.n++
    }
    acc.set(d, a)
  })
  const date = [...acc.keys()].sort()
  return {
    date,
    values: date.map((d) => {
      const a = acc.get(d)!
      if (a.n === 0) return null
      return how === 'sum' ? a.sum : a.sum / a.n
    }),
  }
}
