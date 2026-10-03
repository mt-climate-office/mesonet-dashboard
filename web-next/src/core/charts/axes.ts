/**
 * Axis and grid helpers. Chrome colors and fonts come from the ECharts
 * theme (theme.ts); these set structure only: types, names, ticks, ranges.
 * The zoom and the y-axis rule are in style.ts.
 */
import type { EChartsOption, GridComponentOption, XAXisComponentOption, YAXisComponentOption } from 'echarts'
import type { ChartContext } from './types'

/**
 * `option` without the rotated y-axis titles (`nameLocation: 'middle'`) longer than their plot on
 * a canvas `height` px tall (a short chart: a landscape phone), so a rotated title is never
 * clipped; the unit stays in the page header and tooltip. A horizontal title (the Download
 * preview's panel titles, `nameLocation: 'end'`) runs along the plot, so it always stays. Text is estimated at 0.6 em a character (its font size, else 12 px).
 * A grid sized in px uses its height; any other, the canvas less its px margins.
 */
export function fitAxisNames(option: EChartsOption, height: number): EChartsOption {
  if (!option.yAxis || !(height > 0)) return option
  const grids = (Array.isArray(option.grid) ? option.grid : option.grid ? [option.grid] : []) as GridComponentOption[]
  const px = (v: unknown) => (typeof v === 'number' ? v : 0)
  const plotH = (i: number) => {
    const g = grids[i] ?? grids[0] ?? {}
    return typeof g.height === 'number' ? g.height : height - px(g.top) - px(g.bottom)
  }
  const fit = (a: YAXisComponentOption): YAXisComponentOption => {
    if (typeof a.name !== 'string' || !a.name || a.nameLocation !== 'middle') return a
    const size = Number((a.nameTextStyle as { fontSize?: number } | undefined)?.fontSize) || 12
    const longest = Math.max(...a.name.split('\n').map((l) => l.length))
    return longest * size * 0.6 > plotH((a as { gridIndex?: number }).gridIndex ?? 0) ? { ...a, name: '' } : a
  }
  return { ...option, yAxis: Array.isArray(option.yAxis) ? option.yAxis.map(fit) : fit(option.yAxis) }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * A time-axis tick label for Denver wall-clock ms (read as UTC), 12-hour as on Now: "6 AM",
 * "Noon", "6:30 AM" inside a day; "Sep 29" at midnight; a month start is "Oct", or "Oct 1"
 * when `finer` ticks share the axis (ECharts' tick level > 0), so a month never sits bare
 * beside day labels; Jan 1 is the year.
 */
export function timeTickLabel(ms: number, finer: boolean): string {
  const d = new Date(ms)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  if (h || m) {
    if (h === 12 && !m) return 'Noon'
    return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
  }
  const day = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  if (d.getUTCDate() !== 1) return day
  if (d.getUTCMonth() === 0) return String(d.getUTCFullYear())
  return finer ? day : MONTHS[d.getUTCMonth()]
}

/**
 * Time x axis over Denver wall-clock ms (pair with `useUTC: true` on the option), labelled by
 * `timeTickLabel`. `compact`: fewer ticks, so phone axes do not crowd.
 */
export function timeAxis(opts: { min?: number; max?: number; compact?: boolean } = {}): XAXisComponentOption {
  return {
    type: 'time',
    min: opts.min,
    max: opts.max,
    splitNumber: opts.compact ? 3 : 5,
    splitLine: { show: false },
    axisLabel: { hideOverlap: true, formatter: (v: number, _i: number, extra?: { level?: number }) => timeTickLabel(v, (extra?.level ?? 0) > 0) },
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

/** Grid margins: room on the left for the y axis, on the right for y2 or a color bar, `bottom` (style `bottomLayout`) for the x labels, slider and legend. */
export function grid(ctx: ChartContext, opts: { right?: number; bottom: number; top?: number }): GridComponentOption {
  return {
    left: ctx.compact ? 52 : 64,
    right: opts.right ?? 24,
    top: opts.top ?? 24,
    bottom: opts.bottom,
  }
}
