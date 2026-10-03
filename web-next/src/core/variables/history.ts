/**
 * The variable page's History view: an annual comparison, one line per year
 * on a day-of-year axis (core/charts/agAnnual). Daily data is requested one
 * calendar year per request, so each year caches on its own and the chart
 * fills in as years arrive; never a long hourly window. Summed variables
 * (precipitation, reference ET) show the running total within each year.
 */
import type { AnnualModel } from '../charts/agAnnual'
import { groupByYear } from '../ag/compute/annual'
import { HttpError, type ObservationRow } from '../api'
import { recordRequest, type RecordRequest } from '../latest/requests'
import type { Variable } from './catalog'
import { axisTitle, cumulativeTitle } from './labels'
import { primaryColumn } from './summary'

type ElementRow = { element: string; description_short: string }

/** Years drawn at most (newest first); older years stay in Download. */
export const HISTORY_MAX_YEARS = 10

/** Calendar years from the install year (or the oldest allowed) to this year, newest first. */
export function historyYears(installed: string | null, today: string, max = HISTORY_MAX_YEARS): number[] {
  const last = Number(today.slice(0, 4))
  const first = Math.max(installed ? Number(installed.slice(0, 4)) : last, last - max + 1)
  const out: number[] = []
  for (let y = last; y >= first; y--) out.push(y)
  return out
}

/** One year's daily request: Jan 1 (or the install date) to Dec 31, or to today for this year. */
export function historyRequest(station: string, year: number, v: Variable, elements: readonly ElementRow[], today: string, installed: string | null): RecordRequest | null {
  const jan1 = `${year}-01-01`
  const start = installed && installed > jan1 ? installed : jan1
  const end = String(year) === today.slice(0, 4) ? today : `${year}-12-31`
  return recordRequest({ station, window: { start, end, valid: start <= end }, agg: 'daily', vars: [v.name], stationElements: elements })
}

/**
 * One year's rows from `fetch` (the `historyRequest` query). The API answers a year without
 * data (often the install year) with 404 "No data available": that is an empty year, not a
 * failure, so the chart and its progress line carry on. Other errors propagate.
 */
export async function historyRows(fetch: () => Promise<ObservationRow[]>): Promise<ObservationRow[]> {
  try {
    return await fetch()
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return []
    throw err
  }
}

/**
 * The chart model from the years loaded so far (any order). Each year's
 * daily rows contribute the variable's primary column (shallowest depth).
 * Null until a year has a value.
 */
export function historyModel(v: Variable, years: readonly (readonly ObservationRow[])[], currentYear: number): (AnnualModel & { column: string }) | null {
  const byDate = new Map<string, number | null>()
  let column: string | null = null
  for (const rows of years) {
    if (!rows.length) continue
    const col = primaryColumn(Object.keys(rows[0]), v.name)
    if (!col) continue
    column ??= col
    for (const r of rows) {
      const d = String(r.datetime).slice(0, 10)
      const y = (r as Record<string, unknown>)[col]
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) byDate.set(d, typeof y === 'number' && Number.isFinite(y) ? y : null)
    }
  }
  if (!column || ![...byDate.values()].some((x) => x !== null)) return null
  const dates = [...byDate.keys()]
  const traces = groupByYear(dates, dates.map((d) => byDate.get(d) ?? null), { cumulative: v.sum })
  const axis = axisTitle(v.id, v.name)
  return { traces, yLabel: v.sum ? cumulativeTitle(axis) : axis, currentYear, column, variable: v.name }
}
