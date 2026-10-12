/**
 * The Daily interval's low–high band: each day's true minimum and maximum
 * (one daily request with `agg_func=min,max`, core/latest `recordRequest`
 * `extremes`) attached to the daily-mean series of the variable page's model,
 * matched by column and day. The chart draws it (core/charts/variable.ts) and
 * the stats take Low/High from it. Pure.
 */
import type { ObservationRow } from '../api'
import type { LatestTimeseriesModel } from '../charts/latestTimeseries'
import { labSwapHeader } from '../params'
import { parseWallClock } from '../sensorEvents'
import type { Variable } from './catalog'

/** Variables with a band: not totals (precipitation, ETr) and not wind direction (a circular mean). */
export const hasBand = (v: Pick<Variable, 'sum' | 'name'>): boolean => !v.sum && v.name !== 'Wind Direction'

/**
 * "Minimum Air Temperature @ 2 m [°F]" → the edge and the mean column it
 * belongs to ("Air Temperature [°F]", renamed as core/csv renames the mean's);
 * null for any other column.
 */
export function extremeColumn(col: string): { edge: 'lo' | 'hi'; column: string } | null {
  const m = /^(Minimum|Maximum) (.+)$/.exec(col)
  return m ? { edge: m[1] === 'Minimum' ? 'lo' : 'hi', column: labSwapHeader(m[2]) } : null
}

/** `m` with `band` set on every series the extreme `rows` cover (by wall-clock day); `m` itself without rows. */
export function withBand(m: LatestTimeseriesModel, rows: readonly ObservationRow[]): LatestTimeseriesModel {
  if (!rows.length) return m
  const cols = Object.keys(rows[0]).flatMap((c) => {
    const e = extremeColumn(c)
    return e ? [{ raw: c, ...e }] : []
  })
  const byTime = new Map<number, Record<string, unknown>>()
  for (const r of rows) {
    const t = parseWallClock(r.datetime)
    if (t !== null) byTime.set(t, r as Record<string, unknown>)
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const edge = (series: string, which: 'lo' | 'hi') => {
    const c = cols.find((x) => x.column === series && x.edge === which)
    return c ? m.ts.x.map((x) => num(byTime.get(x)?.[c.raw])) : null
  }
  const panels = m.ts.panels.map((p) => ({
    ...p,
    series: p.series.map((s) => {
      const lo = edge(s.name, 'lo')
      const hi = edge(s.name, 'hi')
      return lo && hi ? { ...s, band: { lo, hi } } : s
    }),
  }))
  return { ...m, ts: { ...m.ts, panels } }
}
