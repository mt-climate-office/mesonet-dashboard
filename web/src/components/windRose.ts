/**
 * Wind-rose speed binning, a port of legacy `plot_wind`: speeds are rounded
 * to whole mph with numpy's round-half-to-even, then `pd.qcut(q=8,
 * duplicates="drop")`. qcut's edges are numpy linear-interpolated quantiles,
 * so they can be fractional (e.g. 3.75). Bins are right-closed, the first
 * includes the minimum, and duplicate edges collapse.
 */

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
 * the legacy title "Wind Data from {start} to {end}". API datetimes are
 * America/Denver wall clock ("2026-10-01 10:00:00-06:00"), so the date is the
 * leading 10 characters. Null when no row has a date.
 */
export function windDateSpan(datetimes: readonly string[]): [string, string] | null {
  const days = datetimes.map((d) => d.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  if (days.length === 0) return null
  days.sort()
  return [days[0], days[days.length - 1]]
}
