/**
 * Wind rose for the Latest tab's top card: speed binning plus the
 * renderer-free model (counts per compass point × speed bin) that the ECharts
 * polar-bar builder consumes. Binning is a port of legacy `plot_wind`: speeds
 * are rounded to whole mph with numpy's round-half-to-even, then `pd.qcut(q=8,
 * duplicates="drop")`. qcut's edges are numpy linear-interpolated quantiles,
 * so they can be fractional (e.g. 3.75). Bins are right-closed, the first
 * includes the minimum, and duplicate edges collapse.
 */
import type { ObservationRow } from '../api'
import { degToCompass, WIND_DIRECTIONS } from '../params'

/** Columns the card requests (`elements=wind_spd,wind_dir`, LAB_SWAP names). */
export const WIND_DIR_COLUMN = 'Wind Direction [deg]'
export const WIND_SPEED_COLUMN = 'Wind Speed [mi/hr]'

/** numpy `round` (half to even), e.g. 2.5 → 2, 3.5 → 4. */
export function roundHalfEven(x: number): number {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

/** numpy-style linear quantile of sorted values. */
function quantileSorted(sorted: readonly number[], q: number): number {
  const pos = q * (sorted.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/** qcut edges: the 0, 1/n, …, 1 quantiles, duplicates dropped. */
export function quantileEdges(values: readonly number[], n = 8): number[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)
  const edges: number[] = []
  for (let i = 0; i <= n; i++) {
    const e = quantileSorted(sorted, i / n)
    if (edges.length === 0 || e > edges[edges.length - 1] + 1e-12) edges.push(e)
  }
  return edges
}

export interface SpeedBins {
  /** Strictly increasing qcut edges (min … max), duplicates dropped. */
  edges: number[]
  numBins: number
  /** Bin index for a raw (unrounded) speed; rounds first, like legacy. */
  binFor: (speed: number) => number
  /**
   * Label per bin: the whole-mph speeds it holds, e.g. "4 – 6", or "3" for
   * one value; pandas-style "(5, 5.75]" for a bin that holds no whole number.
   */
  labels: string[]
}

export function speedBins(rawSpeeds: readonly number[], n = 8): SpeedBins {
  const speeds = rawSpeeds.filter(Number.isFinite).map(roundHalfEven)
  const edges = quantileEdges(speeds, n)
  const numBins = Math.max(1, edges.length - 1)
  const binFor = (speed: number) => {
    const s = roundHalfEven(speed)
    for (let i = 0; i < numBins - 1; i++) if (s <= edges[i + 1]) return i
    return numBins - 1
  }
  const labels = Array.from({ length: numBins }, (_, b) => {
    if (edges.length < 2) return edges.length ? `${edges[0]}` : ''
    // Bin 0 is [e0, e1]; bin b is (e_b, e_b+1].
    const lo = b === 0 ? Math.ceil(edges[0]) : Math.floor(edges[b]) + 1
    const hi = Math.floor(edges[b + 1])
    if (lo > hi) return `(${+edges[b].toFixed(3)}, ${+edges[b + 1].toFixed(3)}]`
    return lo === hi ? `${hi}` : `${lo} – ${hi}`
  })
  return { edges, numBins, binFor, labels }
}

/**
 * First and last local calendar date of the fetched rows ("YYYY-MM-DD"), for
 * the title ("Wind, Sep 19 – Oct 2", core/charts windRoseTitle). API datetimes are
 * America/Denver wall clock ("2026-10-01 10:00:00-06:00"), so the date is the
 * leading 10 characters. Null when no row has a date.
 */
export function windDateSpan(datetimes: readonly string[]): [string, string] | null {
  const days = datetimes.map((d) => d.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  if (days.length === 0) return null
  days.sort()
  return [days[0], days[days.length - 1]]
}

/** One speed bin across the 16 compass points (N, NNE, … NNW). */
export interface WindRoseBin {
  /** Whole-mph range, e.g. "4 – 6" (see `speedBins`). */
  label: string
  /** Observation counts aligned with `WIND_DIRECTIONS`. */
  counts: number[]
}

export interface WindRoseModel {
  directions: readonly string[]
  /** Slowest → fastest; every qcut bin is present, even with zero counts. */
  bins: WindRoseBin[]
  /** The data's first and last local dates (YYYY-MM-DD), for the title, or null. */
  span: [string, string] | null
  /** Rows that had both a direction and a speed. */
  n: number
}

/**
 * Count rows by compass point and speed bin. Rows missing either value are
 * skipped; null when none remain (the card then shows its no-data text).
 */
export function buildWindRoseModel(rows: readonly ObservationRow[]): WindRoseModel | null {
  const obs: { dir: number; spd: number }[] = []
  for (const r of rows) {
    const dir = (r as Record<string, unknown>)[WIND_DIR_COLUMN]
    const spd = (r as Record<string, unknown>)[WIND_SPEED_COLUMN]
    if (typeof dir === 'number' && typeof spd === 'number' && Number.isFinite(dir) && Number.isFinite(spd)) {
      obs.push({ dir, spd })
    }
  }
  if (obs.length === 0) return null
  const { numBins, binFor, labels } = speedBins(obs.map((o) => o.spd))
  const bins: WindRoseBin[] = labels.slice(0, numBins).map((label) => ({ label, counts: WIND_DIRECTIONS.map(() => 0) }))
  for (const o of obs) {
    const d = (WIND_DIRECTIONS as readonly string[]).indexOf(degToCompass(o.dir))
    bins[binFor(o.spd)].counts[d] += 1
  }
  return { directions: WIND_DIRECTIONS, bins, span: windDateSpan(rows.map((r) => String(r.datetime))), n: obs.length }
}
