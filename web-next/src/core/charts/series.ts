/**
 * Series helpers: [x, y] points with gap breaks, and line / bar / marker
 * series with the house defaults (no symbols on lines, LTTB on long lines,
 * nulls break lines). Colors are passed in from core/palette.
 */
import type { BarSeriesOption, LineSeriesOption, ScatterSeriesOption } from 'echarts'
import type { Nullable } from '../ag/contract'

/** One chart point: x (wall-clock ms or a number), y (null = gap), optional tooltip note. */
export type Point = [number, Nullable] | [number, Nullable, string]

/** Line series longer than this get `sampling: 'lttb'`. */
export const LTTB_THRESHOLD = 2000

/** Series ids with this prefix are drawing aids: the tooltip and table skip them. */
export const AUX = 'aux:'

/**
 * Zip x and y into points. Where a step exceeds `ratio` × the median step,
 * a null point is inserted midway so the line breaks (same rule as
 * core/gaps.ts `insertGaps`). Nulls already in `ys` also break lines.
 */
export function points(xs: number[], ys: Nullable[], notes?: string[], ratio = 1.5): Point[] {
  const mk = (i: number): Point => (notes ? [xs[i], ys[i] ?? null, notes[i]] : [xs[i], ys[i] ?? null])
  if (xs.length < 3) return xs.map((_, i) => mk(i))
  const deltas = xs.slice(1).map((x, i) => x - xs[i]).filter((d) => d > 0).sort((a, b) => a - b)
  const limit = deltas.length ? deltas[Math.floor(deltas.length / 2)] * ratio : Infinity
  const out: Point[] = [mk(0)]
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i - 1] > limit) out.push([(xs[i] + xs[i - 1]) / 2, null])
    out.push(mk(i))
  }
  return out
}

/** Thin line, no symbols, gaps kept, LTTB when long. */
export function lineSeries(
  name: string,
  data: Point[],
  style: { color: string; width?: number; dash?: 'dashed' | 'dotted'; yAxisIndex?: number; id?: string },
): LineSeriesOption {
  return {
    type: 'line',
    id: style.id,
    name,
    data,
    yAxisIndex: style.yAxisIndex ?? 0,
    showSymbol: false,
    symbol: 'circle',
    connectNulls: false,
    color: style.color,
    lineStyle: { color: style.color, width: style.width ?? 2, type: style.dash ?? 'solid' },
    emphasis: { focus: 'none', lineStyle: { width: style.width ?? 2 } },
    sampling: data.length > LTTB_THRESHOLD ? 'lttb' : undefined,
  }
}

/** Bars on a time axis; `barMaxWidth` keeps a short window from drawing slabs. */
export function barSeries(name: string, data: Point[], color: string, yAxisIndex = 0): BarSeriesOption {
  return { type: 'bar', name, data, yAxisIndex, color, itemStyle: { color }, barMaxWidth: 18, barCategoryGap: '20%' }
}

/** Marker-only series (regime / class markers). Null points are dropped. */
export function markerSeries(
  name: string,
  data: Point[],
  style: { color: string; symbol?: string; size?: number },
): ScatterSeriesOption {
  return {
    type: 'scatter',
    name,
    data: data.filter((p) => p[1] != null),
    color: style.color,
    itemStyle: { color: style.color },
    symbol: style.symbol ?? 'circle',
    symbolSize: style.size ?? 6,
  }
}
