/**
 * The variable page's stats card: low / high / average of each plotted column
 * over the visible window, or the total for summed variables (precipitation,
 * reference ET). Input is one core/models/timeseries panel (display units).
 * With a daily low–high band (band.ts), Low and High are the true extremes
 * from the band, not the extremes of the daily means. Wind direction has one
 * stat, its prevailing direction (a vector mean, core/variables/direction):
 * the low, high and plain average of bearings mean nothing.
 */
import type { TimeseriesPanel } from '../models/timeseries'
import { PREVAILING_MIN_STRENGTH, WIND_DIRECTION, circularMean } from './direction'
import { LABELS, compassWord, formatReading } from './labels'

export interface StatItem {
  label: 'Low' | 'High' | 'Average' | 'Total' | 'Prevailing'
  /** Formatted with the unit ("41.2 °F"), or "—" with no values; Prevailing is "SE (135°)" or "Variable". */
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
 * (`x` aligned with the series values, wall-clock ms). With the variable's
 * `id`, values use its plain unit and table precision (core/variables/labels).
 *
 * `partial` is the x of today's daily row while the day is in progress (core/latest
 * `partialDay`). It counts where what it holds has happened: the Total so far, and
 * Low / High from the daily band (true readings). It is left out of what averages
 * whole days: Average, Prevailing, and Low / High of the daily means without a band
 * (a few hours' mean just after midnight would read as the window's coldest day).
 */
export function panelStats(
  panel: TimeseriesPanel,
  x: readonly number[],
  view: readonly [number, number],
  sum: boolean,
  id?: string,
  partial: number | null = null,
): StatRow[] {
  const single = panel.series.length === 1
  return panel.series.map((s) => {
    const within = (ys: readonly (number | null)[], whole = false) => {
      const out: number[] = []
      ys.forEach((v, i) => {
        if (whole && x[i] === partial) return
        if (v !== null && Number.isFinite(v) && x[i] >= view[0] && x[i] < view[1]) out.push(v)
      })
      return out
    }
    // A total keeps the day so far; averages of whole days leave it out.
    const vals = within(s.values, !sum)
    const unit = unitOf(s.name)
    const plain = id !== undefined && id in LABELS
    const fmt = (v: number | null) => (v === null ? '—' : plain ? formatReading(id, v, 'table') : `${fmtStat(v)}${unit ? ` ${unit}` : ''}`)
    const label = single ? '' : (s.depth ?? s.name.replace(/\s*\[[^\]]*\]\s*$/, ''))
    if (sum) return { label, items: [{ label: 'Total', value: fmt(vals.length ? vals.reduce((a, b) => a + b, 0) : null) }] }
    if (panel.variable === WIND_DIRECTION) return { label, items: [{ label: 'Prevailing', value: prevailing(vals) }] }
    // A reduce, not Math.min(...vals): a long raw window would overflow the argument list.
    // The band's lows and highs are readings, so today's so far count.
    const lows = s.band ? within(s.band.lo) : vals
    const highs = s.band ? within(s.band.hi) : vals
    const min = lows.length ? lows.reduce((a, b) => (b < a ? b : a)) : null
    const max = highs.length ? highs.reduce((a, b) => (b > a ? b : a)) : null
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    return {
      label,
      items: [
        { label: 'Low', value: fmt(min) },
        { label: 'High', value: fmt(max) },
        { label: 'Average', value: fmt(mean) },
      ],
    }
  })
}

/** "SE (135°)" for the vector mean of `degs`; "Variable" when no direction prevails; "—" without values. */
export function prevailing(degs: readonly number[]): string {
  const m = circularMean(degs)
  if (!m) return '—'
  return m.strength < PREVAILING_MIN_STRENGTH ? 'Variable' : `${compassWord(m.deg)} (${Math.round(m.deg) % 360}°)`
}
