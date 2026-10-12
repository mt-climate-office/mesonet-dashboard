/**
 * gridMET 1991–2020 normals for the Now overview, from the daily CSV rows
 * (core/normals.ts `fetchDailyNormals`): today's median high/low, and the
 * normal precipitation from Jan 1 through today.
 */
import type { NormalRow } from '../normals'

const md = (today: string): [number, number] => [Number(today.slice(5, 7)), Number(today.slice(8, 10))]
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/** The `median` for the month/day of `today` (YYYY-MM-DD), or null. */
export function normalMedianOn(rows: readonly NormalRow[], today: string): number | null {
  const [m, d] = md(today)
  const v = rows.find((r) => r.month === m && r.day === d)?.median
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Normal year-to-date total: the sum of daily `mean`s from Jan 1 through
 * `today` (a sum of means is the mean of the totals; medians would not add).
 * Feb 29 counts only in leap years. Null when any day is missing.
 */
export function ytdNormal(rows: readonly NormalRow[], today: string): number | null {
  const [m, d] = md(today)
  const leap = isLeap(Number(today.slice(0, 4)))
  let sum = 0
  let days = 0
  for (const r of rows) {
    if (r.month > m || (r.month === m && r.day > d)) continue
    if (r.month === 2 && r.day === 29 && !leap) continue
    if (typeof r.mean !== 'number' || !Number.isFinite(r.mean)) return null
    sum += r.mean
    days++
  }
  return days ? sum : null
}
