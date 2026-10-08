/**
 * The one wind rose model (Now's media card and the Wind direction page's Rose
 * view): speed binning, the renderer-free model (counts per compass point ×
 * speed bin) that the ECharts polar-bar builder consumes, and its stats. Calm
 * readings (under CALM_MPH) have no meaningful direction: they are counted
 * apart, not drawn. Binning is a port of legacy `plot_wind`: speeds
 * are rounded to whole mph with numpy's round-half-to-even, then `pd.qcut(q=8,
 * duplicates="drop")`. qcut's edges are numpy linear-interpolated quantiles,
 * so they can be fractional (e.g. 3.75). Bins are right-closed, the first
 * includes the minimum, and duplicate edges collapse.
 */
import type { ObservationRow } from '../api'
import { CALM_MPH } from '../overview/summary'
import { degToCompass, WIND_DIRECTIONS } from '../params'
import { parseWallClock } from '../sensorEvents'
import { formatReading } from '../variables/labels'

/** Columns the rose requests (`elements=wind_spd,wind_dir`, LAB_SWAP names). */
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
  /** Slowest → fastest: the qcut bins that hold readings (a bin between two whole speeds, "(6, 6.25]", holds none and is dropped). Empty when every reading was calm. */
  bins: WindRoseBin[]
  /** The data's first and last local dates (YYYY-MM-DD), for the title, or null. */
  span: [string, string] | null
  /** Drawn readings: a direction and a speed of at least CALM_MPH. */
  n: number
  /** Calm readings (a direction and a speed under CALM_MPH): counted, not drawn. */
  calm: number
  /** Mean speed over every reading, calm ones included (mph). */
  meanSpeed: number
}

/**
 * Count rows by compass point and speed bin (qcut over the drawn speeds).
 * Rows missing either value are skipped; calm rows are counted in `calm`.
 * Null when no row has both values (the card then shows its no-data text).
 */
export function buildWindRoseModel(rows: readonly ObservationRow[]): WindRoseModel | null {
  const obs: { dir: number; spd: number }[] = []
  let calm = 0
  let sum = 0
  for (const r of rows) {
    const dir = (r as Record<string, unknown>)[WIND_DIR_COLUMN]
    const spd = (r as Record<string, unknown>)[WIND_SPEED_COLUMN]
    if (typeof dir !== 'number' || typeof spd !== 'number' || !Number.isFinite(dir) || !Number.isFinite(spd)) continue
    sum += spd
    if (spd < CALM_MPH) calm++
    else obs.push({ dir, spd })
  }
  const total = obs.length + calm
  if (total === 0) return null
  const base = { directions: WIND_DIRECTIONS, span: windDateSpan(rows.map((r) => String(r.datetime))), n: obs.length, calm, meanSpeed: sum / total }
  if (obs.length === 0) return { ...base, bins: [] }
  const { numBins, binFor, labels } = speedBins(obs.map((o) => o.spd))
  const bins: WindRoseBin[] = labels.slice(0, numBins).map((label) => ({ label, counts: WIND_DIRECTIONS.map(() => 0) }))
  for (const o of obs) {
    const d = (WIND_DIRECTIONS as readonly string[]).indexOf(degToCompass(o.dir))
    bins[binFor(o.spd)].counts[d] += 1
  }
  return { ...base, bins: bins.filter((b) => b.counts.some((c) => c > 0)) }
}

/** Drawn readings per compass point, every speed bin together (aligned with `directions`). */
export const directionTotals = (m: WindRoseModel): number[] => m.directions.map((_, i) => m.bins.reduce((a, b) => a + b.counts[i], 0))

/** `count` as a share of every reading, calm included: "18%", "<1%" for a few, "0%" for none. */
export function shareText(count: number, m: Pick<WindRoseModel, 'n' | 'calm'>): string {
  const total = m.n + m.calm
  if (!total || !count) return '0%'
  const pct = (100 * count) / total
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`
}

export interface WindRoseStat {
  label: 'Most often from' | 'Calm' | 'Average speed' | 'Readings'
  value: string
}

/**
 * The Rose view's stats card: the compass point the wind most often came from
 * with its share of every reading ("Calm" when nothing was drawn; the first
 * point clockwise from N on a tie), the calm share, the mean speed (calm
 * included, table precision) and how many readings the rose holds.
 */
export function windRoseStats(m: WindRoseModel): WindRoseStat[] {
  const totals = directionTotals(m)
  const top = Math.max(...totals)
  return [
    { label: 'Most often from', value: m.n === 0 ? 'Calm' : `${m.directions[totals.indexOf(top)]} · ${shareText(top, m)}` },
    { label: 'Calm', value: shareText(m.calm, m) },
    { label: 'Average speed', value: formatReading('wind_spd', m.meanSpeed, 'table') },
    { label: 'Readings', value: (m.n + m.calm).toLocaleString('en-US') },
  ]
}

/** Rows stamped (Denver wall clock) inside `[from, to)` (wall-clock ms); rows without a stamp are dropped. */
export function rowsWithin(rows: readonly ObservationRow[], [from, to]: readonly [number, number]): ObservationRow[] {
  return rows.filter((r) => {
    const ms = parseWallClock(r.datetime)
    return ms !== null && ms >= from && ms < to
  })
}

/** The newest row's stamp (Denver wall-clock ms), or null without one. */
export function newestStamp(rows: readonly ObservationRow[]): number | null {
  let best: number | null = null
  for (const r of rows) {
    const ms = parseWallClock(r.datetime)
    if (ms !== null && (best === null || ms > best)) best = ms
  }
  return best
}

