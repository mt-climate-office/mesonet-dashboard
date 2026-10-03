/**
 * The variable page's stats row: min / max / mean of each plotted column over
 * the visible window, or the total for summed variables (precipitation,
 * reference ET). Input is one core/models/timeseries panel (display units).
 */
import type { TimeseriesPanel } from '../models/timeseries'

export interface StatItem {
  label: 'Min' | 'Max' | 'Mean' | 'Total'
  /** Formatted with the unit ("41.2 °F"), or "—" with no values. */
  value: string
}

export interface StatRow {
  /** What tells the columns apart: the depth ("4 in"), the column, or '' for a single column. */
  label: string
  items: StatItem[]
}

/** "[°F]" at the end of a column name → "°F"; '' without one. */
const unitOf = (col: string) => /\[([^\]]+)\]\s*$/.exec(col)?.[1] ?? ''

/** Stat number: 2 decimals under 10, 1 under 100, else whole; trailing zeros dropped. */
export function fmtStat(v: number): string {
  const a = Math.abs(v)
  return String(Number(v.toFixed(a < 10 ? 2 : a < 100 ? 1 : 0)))
}

/**
 * One row per series of `panel`, over the points with `view[0] <= x < view[1]`
 * (`x` aligned with the series values, wall-clock ms).
 */
export function panelStats(panel: TimeseriesPanel, x: readonly number[], view: readonly [number, number], sum: boolean): StatRow[] {
  const single = panel.series.length === 1
  return panel.series.map((s) => {
    const vals: number[] = []
    s.values.forEach((v, i) => {
      if (v !== null && Number.isFinite(v) && x[i] >= view[0] && x[i] < view[1]) vals.push(v)
    })
    const unit = unitOf(s.name)
    const fmt = (v: number | null) => (v === null ? '—' : `${fmtStat(v)}${unit ? ` ${unit}` : ''}`)
    const label = single ? '' : (s.depth ?? s.name.replace(/\s*\[[^\]]*\]\s*$/, ''))
    if (sum) return { label, items: [{ label: 'Total', value: fmt(vals.length ? vals.reduce((a, b) => a + b, 0) : null) }] }
    // A loop, not Math.min(...vals): a long raw window would overflow the argument list.
    const n = vals.length
    const min = n ? vals.reduce((a, b) => (b < a ? b : a)) : null
    const max = n ? vals.reduce((a, b) => (b > a ? b : a)) : null
    const mean = n ? vals.reduce((a, b) => a + b, 0) / n : null
    return {
      label,
      items: [
        { label: 'Min', value: fmt(min) },
        { label: 'Max', value: fmt(max) },
        { label: 'Mean', value: fmt(mean) },
      ],
    }
  })
}
