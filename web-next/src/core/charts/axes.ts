/**
 * Axis, grid and zoom helpers. Chrome colors and fonts come from the ECharts
 * theme (theme.ts); these set structure only: types, names, ticks, ranges.
 */
import type { DataZoomComponentOption, GridComponentOption, XAXisComponentOption, YAXisComponentOption } from 'echarts'
import type { ChartContext } from './types'

/** Tick label templates per time level; read in UTC = Denver wall clock (useUTC). */
const TIME_LABELS = {
  year: '{yyyy}',
  month: '{MMM}',
  day: '{MMM} {d}',
  hour: '{HH}:{mm}',
  minute: '{HH}:{mm}',
  second: '{HH}:{mm}:{ss}',
}

/** Time x axis over Denver wall-clock ms. Pair with `useUTC: true` on the option. */
export function timeAxis(opts: { min?: number; max?: number } = {}): XAXisComponentOption {
  return {
    type: 'time',
    min: opts.min,
    max: opts.max,
    splitLine: { show: false },
    axisLabel: { hideOverlap: true, formatter: TIME_LABELS },
  }
}

/** Value y axis titled `name` (newlines allowed), rotated alongside the axis. */
export function valueAxis(name: string, opts: { min?: number; max?: number; right?: boolean } = {}): YAXisComponentOption {
  return {
    type: 'value',
    name,
    nameLocation: 'middle',
    nameGap: opts.right ? 44 : 48,
    nameRotate: opts.right ? -90 : 90,
    position: opts.right ? 'right' : 'left',
    min: opts.min,
    max: opts.max,
    scale: opts.min === undefined,
  }
}

/**
 * Log10 y axis over [min, max] (both > 0). `inverse` flips it (wet SWP at
 * the top); `prefix` is prepended to every tick label (SWP: "-" for suction).
 */
export function logAxis(name: string, min: number, max: number, opts: { inverse?: boolean; prefix?: string } = {}): YAXisComponentOption {
  return {
    type: 'log',
    logBase: 10,
    name,
    nameLocation: 'middle',
    nameGap: 48,
    nameRotate: 90,
    min,
    max,
    inverse: opts.inverse ?? false,
    axisLabel: { formatter: (v: number) => `${opts.prefix ?? ''}${v}` },
  }
}

/**
 * Bars on the left axis, cumulative on the right (y2): both start at 0, y2
 * hides its split lines and aligns its ticks with y1 so one grid reads for both.
 */
export function dualAxis(left: string, right: string, opts: { rightMax?: number } = {}): YAXisComponentOption[] {
  return [
    valueAxis(left, { min: 0 }),
    { ...valueAxis(right, { min: 0, max: opts.rightMax, right: true }), splitLine: { show: false }, alignTicks: true },
  ]
}

/** The smallest 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ᵏ at or above `v` (≥ 0); 0 → 1. A round axis max. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v - 1e-9 * p) return m * p
  return 10 * p
}

/** Powers of ten bracketing [lo, hi] (both > 0), widened to include `include`. */
export function logExtent(lo: number, hi: number, include: number[] = []): [number, number] {
  const vals = [lo, hi, ...include].filter((v) => v > 0 && Number.isFinite(v))
  if (vals.length === 0) return [0.1, 100]
  return [10 ** Math.floor(Math.log10(Math.min(...vals))), 10 ** Math.ceil(Math.log10(Math.max(...vals)))]
}

/** Grid margins; room on the right for y2 or a color bar, at the bottom for legend + zoom slider. */
export function grid(ctx: ChartContext, opts: { right?: number; bottom?: number; top?: number } = {}): GridComponentOption {
  return {
    left: ctx.compact ? 52 : 64,
    right: opts.right ?? 24,
    top: opts.top ?? 24,
    bottom: opts.bottom ?? (ctx.compact ? 56 : 84),
  }
}

/**
 * x-axis zoom: shift+wheel or pinch inside the plot, plus a slider on wide
 * screens. Drag-to-pan is off on compact screens. On touch the inside zoom is
 * `disabled`: it still holds the visible window (the host zooms through it),
 * but takes no gestures, so a swipe over the chart scrolls the page. The date
 * controls and range presets are the keyboard and touch twin.
 */
export function timeZoom(ctx: ChartContext): DataZoomComponentOption[] {
  const inside: DataZoomComponentOption = {
    type: 'inside',
    xAxisIndex: 0,
    filterMode: 'none',
    disabled: ctx.touch,
    zoomOnMouseWheel: 'shift',
    moveOnMouseWheel: false,
    moveOnMouseMove: !ctx.compact,
  }
  if (ctx.compact) return [inside]
  return [inside, { type: 'slider', xAxisIndex: 0, filterMode: 'none', height: 18, bottom: 36, labelFormatter: '' }]
}
