/**
 * Sparkline builder: a short series → SVG geometry (path data or bars) in a
 * fixed viewBox, plus a one-line text summary for screen readers. Pure, and
 * SVG rather than ECharts on purpose: the Now tiles draw eight of these, they
 * must never capture a touch scroll, and they should not wait for the
 * ECharts chunk. Rendered with `<svg viewBox><path :d>` (ui/now, DESIGN.md).
 */

export interface SparkSeries {
  /** x values, ascending (any unit; Denver wall-clock ms in the app). */
  t: readonly number[]
  /** y values; null breaks the line. */
  v: readonly (number | null)[]
}

export interface SparkOptions {
  /** 'line' (default) or 'bars' (precipitation: one bar per point from 0). */
  kind?: 'line' | 'bars'
  /** viewBox size (default 100 × 28); the SVG scales to its box with preserveAspectRatio="none". */
  width?: number
  height?: number
  /** Force the y range to include 0 (bars always do). */
  zero?: boolean
}

export interface Sparkline {
  viewBox: string
  kind: 'line' | 'bars'
  /** Line: stroke path (`M…L…`), one `M` per unbroken run. Bars: one fill path of rectangles. */
  d: string
  /** Bars as `{x, y, w, h}` in viewBox units; [] for lines. */
  bars: { x: number; y: number; w: number; h: number }[]
  min: number
  max: number
  /** Number of finite points drawn. */
  points: number
}

const r2 = (x: number) => Math.round(x * 100) / 100

/** Geometry for `s`, or null when it has no finite value (the tile shows no sparkline). */
export function sparkline(s: SparkSeries, opts: SparkOptions = {}): Sparkline | null {
  const kind = opts.kind ?? 'line'
  const W = opts.width ?? 100
  const H = opts.height ?? 28
  const pts: [number, number][] = []
  for (let i = 0; i < s.t.length; i++) {
    const y = s.v[i]
    if (typeof y === 'number' && Number.isFinite(y)) pts.push([s.t[i], y])
  }
  if (!pts.length) return null
  const t0 = s.t[0]
  const t1 = s.t[s.t.length - 1]
  let min = Math.min(...pts.map((p) => p[1]))
  const max = Math.max(...pts.map((p) => p[1]))
  if (kind === 'bars' || opts.zero) min = Math.min(0, min)
  // 1 px of padding top and bottom so a 2 px stroke is never clipped.
  const pad = kind === 'line' ? 1.5 : 0
  const span = max - min || 1
  const x = (t: number) => (t1 === t0 ? W / 2 : ((t - t0) / (t1 - t0)) * W)
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad)

  if (kind === 'bars') {
    const w = Math.max(0.6, (W / Math.max(1, s.t.length)) * 0.8)
    const bars = pts
      .filter((p) => p[1] > 0)
      .map(([t, v]) => {
        const top = y(v)
        return { x: r2(Math.min(W - w, Math.max(0, x(t) - w / 2))), y: r2(top), w: r2(w), h: r2(H - top) }
      })
    // The same bars as one filled path, so the SVG needs no per-bar elements (no x-for inside <svg>),
    // on a 1-unit baseline so a dry window still reads as "zero", not as a missing chart.
    const d = `M0 ${H - 1}h${W}v1h${-W}Z` + bars.map((b) => `M${b.x} ${b.y}h${b.w}v${b.h}h${-b.w}Z`).join('')
    return { viewBox: `0 0 ${W} ${H}`, kind, d, bars, min, max, points: pts.length }
  }

  let d = ''
  let pen = false
  for (let i = 0; i < s.t.length; i++) {
    const v = s.v[i]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${r2(x(s.t[i]))} ${r2(y(v))}`
    pen = true
  }
  return { viewBox: `0 0 ${W} ${H}`, kind, d, bars: [], min, max, points: pts.length }
}
