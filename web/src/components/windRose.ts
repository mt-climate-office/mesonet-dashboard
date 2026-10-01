/**
 * Wind-rose speed binning. Legacy (`plot_wind`) rounds speeds to whole mph,
 * then `pd.qcut(q=8, duplicates="drop")`, so bin edges are integers and no
 * two bins share a label.
 */

/** n-quantile cut points by floor index (n − 1 values) over sorted values. */
export function quantileCuts(values: readonly number[], n = 8): number[] {
  if (values.length === 0) return []
  const sorted = [...values].sort((a, b) => a - b)
  const cuts: number[] = []
  for (let i = 1; i < n; i++) cuts.push(sorted[Math.floor((sorted.length * i) / n)])
  return cuts
}

export interface SpeedBins {
  /** Strictly increasing integer cut points (duplicates dropped). */
  cuts: number[]
  numBins: number
  /** Bin index for a raw (unrounded) speed; rounds first, like legacy. */
  binFor: (speed: number) => number
  /**
   * Label per bin index, e.g. "2 – 4", or "5" for a single-value bin; ''
   * for the empty top bin left when the max speed is itself a cut point.
   */
  labels: string[]
}

export function speedBins(rawSpeeds: readonly number[], n = 8): SpeedBins {
  const speeds = rawSpeeds.filter(Number.isFinite).map(Math.round)
  const cuts: number[] = []
  for (const c of quantileCuts(speeds, n)) {
    if (cuts.length === 0 || c > cuts[cuts.length - 1]) cuts.push(c)
  }
  const numBins = cuts.length + 1
  const binFor = (speed: number) => {
    const s = Math.round(speed)
    for (let i = 0; i < cuts.length; i++) if (s <= cuts[i]) return i
    return cuts.length
  }
  const min = speeds.length ? Math.min(...speeds) : 0
  const max = speeds.length ? Math.max(...speeds) : 0
  // Bin 0 is [min, cut0]; bin b is (cut[b-1], cut[b]], whose smallest whole
  // value is cut[b-1] + 1; the last bin runs to max.
  const labels = Array.from({ length: numBins }, (_, b) => {
    const lo = b === 0 ? min : cuts[b - 1] + 1
    const hi = b === cuts.length ? max : cuts[b]
    if (lo > hi) return ''
    return lo === hi ? `${hi}` : `${lo} – ${hi}`
  })
  return { cuts, numBins, binFor, labels }
}
