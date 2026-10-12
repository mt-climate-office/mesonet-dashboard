/**
 * Annual (year-over-year) grouping on local dates: split a series into one
 * trace per calendar year keyed by day of year, optionally as a running sum
 * within each year (precipitation, ETo, GDD and other accumulating
 * variables).
 *
 * Day of year is the local (America/Denver) date's own DOY, so in leap years
 * Mar 1 is DOY 61 and Dec 31 is DOY 366.
 *
 * {@link groupByYear} takes **daily** input only (one row per `YYYY-MM-DD`;
 * it throws on hourly timestamps or duplicate dates). Aggregate hourly data
 * first with {@link hourlyToDaily}.
 */
import type { LocalDate, LocalDateTime, Nullable } from '../contract'
import { cumulativeSum, dayOfYear, denverMidnightEpochMs, ok } from './util'

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
 * each trace is returned in date order, and traces in year order.
 *
 * @throws if a date is not `YYYY-MM-DD` or appears more than once.
 */
export function groupByYear(
  dates: LocalDate[],
  values: Nullable[],
  opts: AnnualOptions = {},
): AnnualTrace[] {
  const byYear = new Map<number, Map<LocalDate, Nullable>>()
  dates.forEach((d, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      throw new Error(`groupByYear expects daily YYYY-MM-DD dates, got "${d}" (use hourlyToDaily first)`)
    }
    const y = Number(d.slice(0, 4))
    let m = byYear.get(y)
    if (!m) byYear.set(y, (m = new Map()))
    if (m.has(d)) throw new Error(`groupByYear: duplicate date ${d}`)
    m.set(d, ok(values[i]) ? values[i] : null)
  })
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, m]) => {
      const date = [...m.keys()].sort()
      const raw = date.map((d) => m.get(d) ?? null)
      return { year, date, doy: date.map(dayOfYear), values: opts.cumulative ? cumulativeSum(raw) : raw }
    })
}

/** Number of clock hours in a local (America/Denver) day: 23, 24 or 25. */
export function hoursInLocalDay(date: LocalDate): number {
  const next = new Date(Date.parse(`${date}T00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  return Math.round((denverMidnightEpochMs(next) - denverMidnightEpochMs(date)) / 3_600_000)
}

export interface HourlyToDailyOptions {
  /**
   * Minimum valid hours for a day to get a value; fewer → null. Defaults to
   * every hour of the local day for `'sum'` (23/24/25 across DST, so a
   * partial day never looks like a low total) and 1 for `'mean'`.
   */
  minHours?: number
}

/**
 * Aggregate an hourly series to local-date daily values (sum or mean of
 * non-null hours), for feeding {@link groupByYear}. Hours are grouped by
 * the local date of their timestamp (first 10 characters).
 */
export function hourlyToDaily(
  time: LocalDateTime[],
  values: Nullable[],
  how: 'sum' | 'mean',
  opts: HourlyToDailyOptions = {},
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
      const min = opts.minHours ?? (how === 'sum' ? hoursInLocalDay(d) : 1)
      if (a.n === 0 || a.n < min) return null
      return how === 'sum' ? a.sum : a.sum / a.n
    }),
  }
}
