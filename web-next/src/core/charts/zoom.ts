/**
 * Zoom-window conversions for the chart host. The host's zoom API is always
 * Denver wall-clock ms; a category x axis (heatmaps) zooms by index, so its
 * builder puts each category's wall-clock ms in `xAxis.data` and these map
 * between the two. Also: carrying zoom and legend state across a redraw.
 */
import type { EChartsOption } from 'echarts'

/** [from, to] in wall-clock ms. */
export type Range = [number, number]

/** Wall-clock ms per category when the first x axis is a category axis of numbers; else null (time axis). */
export function categoryMs(option: EChartsOption): number[] | null {
  const x = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis
  if (!x || x.type !== 'category' || !Array.isArray(x.data)) return null
  const ms = x.data.map(Number)
  return ms.every(Number.isFinite) ? ms : null
}

/**
 * A wall-clock range → dataZoom start/end values: unchanged on a time axis;
 * on a category axis, the first index at/after `from` and the last at/before `to`.
 */
export function toAxisRange(r: Range, cats: number[] | null): Range {
  if (!cats || cats.length === 0) return r
  let a = cats.findIndex((c) => c >= r[0])
  let b = cats.length - 1
  while (b > 0 && cats[b] > r[1]) b--
  if (a < 0) a = cats.length - 1
  return [Math.min(a, b), Math.max(a, b)]
}

/** dataZoom start/end values → wall-clock ms (category indices looked up, clamped). */
export function fromAxisRange(v: Range, cats: number[] | null): Range {
  if (!cats || cats.length === 0) return v
  const at = (i: number) => cats[Math.min(cats.length - 1, Math.max(0, Math.round(i)))]
  return [at(v[0]), at(v[1])]
}

/** True when two ranges match within `tolMs` at both ends (an echo of the current window). */
export function sameRange(a: Range | null, b: Range | null, tolMs = 60_000): boolean {
  return !!a && !!b && Math.abs(a[0] - b[0]) <= tolMs && Math.abs(a[1] - b[1]) <= tolMs
}

/** State a redraw should keep: dataZoom percentages and the legend's toggled-off series. */
export interface ViewState {
  zoom?: { start?: number; end?: number }
  selected?: Record<string, boolean>
}

/** Apply kept state to a freshly built option (mutates and returns it). */
export function carryState(option: EChartsOption, s: ViewState): EChartsOption {
  if (s.zoom && Array.isArray(option.dataZoom)) {
    option.dataZoom = option.dataZoom.map((z) => ({ ...z, start: s.zoom!.start, end: s.zoom!.end }))
  }
  if (s.selected && option.legend && !Array.isArray(option.legend)) {
    option.legend = { ...option.legend, selected: { ...s.selected } }
  }
  return option
}
