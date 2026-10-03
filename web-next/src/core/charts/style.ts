/**
 * The one chart style every builder draws with (DESIGN.md "Chart style"): line widths, gap breaks
 * from the known interval, the y-axis rule per variable family, the zoom slider (when it shows,
 * where it sits, which series its background trace comes from) and when a chart animates. Pure.
 */
import type { DataZoomComponentOption, GridComponentOption, LineSeriesOption, XAXisComponentOption, YAXisComponentOption } from 'echarts'
import type { Nullable } from '../ag/contract'
import { grid, timeAxis } from './axes'
import type { ChartContext } from './types'

/** Every data line (stroke px). Reference lines (normals edges, the index line under markers) use `REF_WIDTH`. */
export const LINE_WIDTH = 1.5
export const REF_WIDTH = 1

/** A gap is a step longer than this many expected steps; a null goes in it so the line breaks. */
export const GAP_RATIO = 1.5

const MIN = 60_000
const HOUR = 3_600_000
export const DAY = 86_400_000

/** What a chart's x step is: an interval, or `doy` (day-of-year axes, step 1). */
export type Step = 'raw' | 'hourly' | 'daily' | 'monthly' | 'doy'

/**
 * The expected x step: hourly 1 h, daily 1 day, monthly 31 days, day of year 1. 5-min (`raw`) is
 * the station's own logging interval (5 min, or 15 at some AgriMet stations): the median step of
 * `xs`, never under 5 min.
 */
export function stepMs(step: Step, xs: readonly number[] = []): number {
  if (step === 'hourly') return HOUR
  if (step === 'daily') return DAY
  if (step === 'monthly') return 31 * DAY
  if (step === 'doy') return 1
  const d = xs.slice(1).map((x, i) => x - xs[i]).filter((v) => v > 0).sort((a, b) => a - b)
  return Math.max(5 * MIN, d.length ? d[Math.floor(d.length / 2)] : 5 * MIN)
}

/** One chart point: x (wall-clock ms or a number), y (null = gap), optional tooltip note. */
export type Point = [number, Nullable] | [number, Nullable, string]

/**
 * Zip x and y into points, with a null point midway across every gap (a step over `GAP_RATIO` ×
 * `step`), so a line never connects across missing data. Nulls already in `ys` break it too.
 */
export function points(xs: readonly number[], ys: readonly Nullable[], step: number, notes?: readonly string[]): Point[] {
  const mk = (i: number): Point => (notes ? [xs[i], ys[i] ?? null, notes[i]] : [xs[i], ys[i] ?? null])
  const out: Point[] = []
  for (let i = 0; i < xs.length; i++) {
    if (i > 0 && xs[i] - xs[i - 1] > GAP_RATIO * step) out.push([(xs[i] + xs[i - 1]) / 2, null])
    out.push(mk(i))
  }
  return out
}

/** Running total for an accumulation's slider trace: nulls stay null (the gap shows), the total carries over them. */
export function runningTotal(ys: readonly Nullable[]): Nullable[] {
  let acc = 0
  return ys.map((v) => (v == null ? null : (acc += v)))
}

/**
 * Accumulations (a total per interval: precipitation, reference ET) are bars at every interval
 * (5-min, hourly, daily, monthly): a bar is "this much fell in this step", which a line between
 * steps would misstate. Their slider trace is the running total.
 */
export const isAccumulation = (variable: string): boolean => variable === 'Precipitation' || variable === 'Reference ET'

/* ------------------------------------------------------------------ y axis */

/**
 * How a variable's y axis is scaled:
 * - `zero`: amounts that start at nothing (precipitation, ETr, wind, radiation, snow): 0 to a nice max;
 * - `fixed`: a closed scale (relative humidity 0–100 %, wind direction 0–360°);
 * - `free`: zero means nothing (temperature, pressure, soil moisture …): nice bounds around the data.
 */
export type AxisFamily = 'zero' | 'fixed' | 'free'

const ZERO: Record<string, number> = {
  // The smallest max each zero-based axis shows, so a calm or dry window is not drawn as a full-height wiggle.
  Precipitation: 0.05,
  'Reference ET': 0.05,
  'Max Precip Rate': 0.05,
  'Wind Speed': 5,
  'Gust Speed': 5,
  'Solar Radiation': 100,
  'Snow Depth': 1,
}
const FIXED: Record<string, [number, number, number]> = {
  'Relative Humidity': [0, 100, 25],
  'Wind Direction': [0, 360, 90],
}

/** The axis family of a display variable ("Air Temperature", "Precipitation", …). */
export function axisFamily(variable: string): AxisFamily {
  return variable in FIXED ? 'fixed' : variable in ZERO ? 'zero' : 'free'
}

/** Variables on a free axis that are never negative: their axis stops at 0 when the data does (no "−10 %"). */
const NON_NEGATIVE = new Set(['Soil VWC', 'Bulk EC', 'Atmospheric Pressure', 'VPD', 'Well Water Level', 'Well EC'])

/** The smallest of 1, 2, 2.5, 5 × 10ᵏ at or above `raw` (> 0): a tick step. */
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5]) if (m * p >= raw * (1 - 1e-9)) return m * p
  return 10 * p
}

/** An axis has 4 to 7 tick steps from its min to its max. */
export const MIN_STEPS = 4
export const MAX_STEPS = 7
/** Room kept between the data and the axis ends, as a share of the data's span. */
export const Y_PAD = 0.02

/**
 * [lo, hi] rounded out to whole nice steps: of the steps that give 4–7 intervals, the one with the
 * least padding (the tighter axis; on a tie, the finer step). Never a coarse jump: −21–106 is
 * −20–120 by 20, not −50–150 by 50.
 */
function roundOut(lo: number, hi: number): { min: number; max: number; interval: number } {
  const fit = (step: number) => {
    const min = Math.floor(lo / step + 1e-9) * step
    const max = Math.ceil(hi / step - 1e-9) * step
    return { min: round(min), max: round(max), interval: step, n: Math.round((max - min) / step) }
  }
  let best: ReturnType<typeof fit> | null = null
  let fallback: ReturnType<typeof fit> | null = null
  for (let step = niceStep((hi - lo) / (MAX_STEPS + 1)); ; step = niceStep(step * 1.01)) {
    const f = fit(step)
    if (f.n < MIN_STEPS) {
      fallback ??= f
      break
    }
    if (f.n <= MAX_STEPS) {
      fallback ??= f
      if (!best || f.max - f.min < best.max - best.min - 1e-9) best = f
    }
  }
  const { min, max, interval } = best ?? fallback!
  return { min, max, interval }
}

/**
 * The y-axis bounds and tick step for a variable over data [lo, hi] (null with no data): `zero` is
 * 0 to the max plus 2 %, at least the family's minimum, rounded up to a nice step; `fixed` is its
 * scale; `free` is the span plus 2 % each side, rounded out to nice steps; it stops at 0 for a
 * never-negative variable whose data does, and is otherwise never pulled to 0.
 * Same data → same axis, whatever the range or interval.
 */
export function yBounds(variable: string, lo: number | null, hi: number | null): { min: number; max: number; interval: number } | null {
  const fixed = FIXED[variable]
  if (fixed) return { min: fixed[0], max: fixed[1], interval: fixed[2] }
  if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) return null
  if (variable in ZERO) return roundOut(0, Math.max(hi * (1 + Y_PAD), ZERO[variable]))
  const span = hi - lo || Math.max(Math.abs(hi) * 0.1, 1)
  const pad = span * Y_PAD
  const bottom = NON_NEGATIVE.has(variable) && lo >= 0 ? Math.max(0, lo - pad) : lo - pad
  return roundOut(bottom, hi + pad)
}

/** Float noise off a tick value (0.30000000000000004 → 0.3). */
const round = (v: number) => Number(v.toPrecision(12))

/** Finite min and max of every value in `lists`, or nulls. */
export function extentOf(...lists: readonly (readonly Nullable[] | undefined)[]): [number | null, number | null] {
  let lo = Infinity
  let hi = -Infinity
  for (const l of lists) for (const v of l ?? []) if (v != null && Number.isFinite(v)) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return lo <= hi ? [lo, hi] : [null, null]
}

/** y-axis fields for a variable over data [lo, hi]: `yBounds`, and `scale` (no forced zero) for a free axis. */
export interface YRange {
  min?: number
  max?: number
  interval?: number
  scale: boolean
}

/** `yBounds` as y-axis fields; with no data, only the family's scale and zero floor. */
export function yAxisRange(variable: string, lo: number | null, hi: number | null): YRange {
  const scale = axisFamily(variable) === 'free'
  const b = yBounds(variable, lo, hi)
  return b ? { ...b, scale } : { scale, ...(axisFamily(variable) === 'zero' ? { min: 0 } : {}) }
}

/* ------------------------------------------------------------------ x extent */

/**
 * The plotted x extent of a time chart: first to last x, widened by half a step at each end when it
 * draws bars, so the end bars are whole. The x axis spans exactly this, and so does the slider track.
 */
export function plotExtent(xs: readonly number[], step: number, bars: boolean): [number, number] | null {
  const ok = xs.filter(Number.isFinite)
  if (!ok.length) return null
  const half = bars ? step / 2 : 0
  return [Math.min(...ok) - half, Math.max(...ok) + half]
}

/* ------------------------------------------------------------------ zoom slider */

/** The slider: 18 px tall, 8 px above whatever sits under it (the canvas edge, or a legend). */
export const SLIDER = { height: 18, gap: 8 } as const
/** The x-axis tick labels' row under a plot (px). */
export const AXIS_LABELS_PX = 30
/** The slider adds nothing below this: a window of 2 days or less, or fewer points. */
export const SLIDER_MIN_SPAN = 2 * DAY
export const SLIDER_MIN_POINTS = 30

/**
 * Whether a chart gets the zoom slider: wide screens only (phones zoom with the range chips and
 * date fields), a plotted extent over 2 days and at least 30 points (24 h, short daily windows and
 * the Now strip have none).
 */
export function showsSlider(ctx: Pick<ChartContext, 'compact'>, extent: readonly [number, number] | null, n: number, time = true): boolean {
  if (ctx.compact || !extent || n < SLIDER_MIN_POINTS) return false
  return !time || extent[1] - extent[0] > SLIDER_MIN_SPAN
}

/**
 * The px under the plot: x-axis labels (`labelsPx`, two-line labels need more), the slider when
 * shown, a legend `legendPx` tall (0: none).
 * `grid` is the grid's `bottom`; `slider` the slider's.
 */
export function bottomLayout(slider: boolean, legendPx = 0, labelsPx = AXIS_LABELS_PX): { grid: number; slider: number } {
  const sliderBottom = legendPx + SLIDER.gap
  return { grid: slider ? sliderBottom + SLIDER.height + labelsPx : legendPx + labelsPx, slider: sliderBottom }
}

/**
 * The x zoom of a time chart over `extent` (wall-clock ms; a category axis passes indices): the
 * inside zoom always (shift+wheel or pinch; no drag-pan on compact; `disabled` on touch, so a swipe
 * scrolls the page), plus the slider when `slider` (`showsSlider`), `sliderBottom` px up. Both
 * start at the whole extent; the slider's track is the extent.
 */
export function timeZoom(
  ctx: ChartContext,
  o: { xAxisIndex?: number | number[]; extent?: readonly [number, number] | null; slider: boolean; sliderBottom?: number },
): DataZoomComponentOption[] {
  const xAxisIndex = o.xAxisIndex ?? 0
  const window = o.extent ? { startValue: o.extent[0], endValue: o.extent[1] } : {}
  const inside: DataZoomComponentOption = {
    type: 'inside',
    xAxisIndex,
    filterMode: 'none',
    disabled: ctx.touch,
    zoomOnMouseWheel: 'shift',
    moveOnMouseWheel: false,
    moveOnMouseMove: !ctx.compact,
    ...window,
  }
  if (!o.slider) return [inside]
  const slider: DataZoomComponentOption = {
    type: 'slider',
    xAxisIndex,
    filterMode: 'none',
    height: SLIDER.height,
    bottom: o.sliderBottom ?? SLIDER.gap,
    labelFormatter: '',
    showDataShadow: true,
    ...window,
  }
  return [inside, slider]
}

/** Series id of the slider's background trace (a drawing aid: no tooltip, legend or table). */
export const ZOOM_TRACE_ID = 'aux:zoom-trace'

/**
 * The slider's background trace. ECharts draws the slider's shadow from the first line or bar
 * series on its axis, so this hidden line goes first in `series`, on its own hidden y axis
 * (`yAxisIndex`, in grid `gridIndex`) so it never moves the plotted axes. `trace` is one sensible
 * series (the main line; a band's mean; the shallowest depth; an accumulation's running total;
 * Compare's first panel), padded with nulls at both ends of `extent`, so the shadow spans exactly
 * the track.
 */
export function zoomTrace(
  trace: readonly Point[],
  extent: readonly [number, number] | null,
  o: { yAxisIndex: number; xAxisIndex?: number; gridIndex?: number },
): { series: LineSeriesOption; yAxis: YAXisComponentOption } {
  const ends = extent ? ([[extent[0], null], ...trace.map((p) => [p[0], p[1]] as Point), [extent[1], null]] as Point[]) : trace.map((p) => [p[0], p[1]] as Point)
  return {
    series: {
      type: 'line',
      id: ZOOM_TRACE_ID,
      name: ZOOM_TRACE_ID,
      data: ends,
      xAxisIndex: o.xAxisIndex ?? 0,
      yAxisIndex: o.yAxisIndex,
      showSymbol: false,
      connectNulls: false,
      silent: true,
      legendHoverLink: false,
      lineStyle: { opacity: 0 },
      tooltip: { show: false },
      z: 0,
    },
    yAxis: { type: 'value', gridIndex: o.gridIndex ?? 0, show: false, scale: true },
  }
}

/** Points of `trace` with a value. */
export const valued = (trace: readonly Point[]) => trace.reduce((n, p) => (p[1] == null ? n : n + 1), 0)

/**
 * The frame of a one-grid time chart (the Ag charts): x axis over `extent`, the zoom (slider by
 * `showsSlider` on the trace), the grid's bottom room for labels, slider and a `legendPx` legend,
 * and, with the slider, its trace on the hidden y axis `yAxisIndex` (put `trace.series` first in
 * `series` and `trace.yAxis` at that index).
 */
export function timeFrame(
  ctx: ChartContext,
  o: { extent: [number, number] | null; trace: readonly Point[]; yAxisIndex: number; legendPx?: number; right?: number },
): { grid: GridComponentOption; dataZoom: DataZoomComponentOption[]; xAxis: XAXisComponentOption; trace: ReturnType<typeof zoomTrace> | null } {
  const slider = showsSlider(ctx, o.extent, valued(o.trace))
  const b = bottomLayout(slider, o.legendPx ?? 0)
  return {
    grid: grid(ctx, { right: o.right, bottom: b.grid }),
    dataZoom: timeZoom(ctx, { extent: o.extent, slider, sliderBottom: b.slider }),
    xAxis: timeAxis({ min: o.extent?.[0], max: o.extent?.[1], compact: ctx.compact }),
    trace: slider ? zoomTrace(o.trace, o.extent, { yAxisIndex: o.yAxisIndex }) : null,
  }
}

/** One plain legend row under a chart (px), for `bottomLayout`. */
export const LEGEND_PX = 28

/* ------------------------------------------------------------------ animation */

/** A chart animates its first draw only, and never under reduced motion: not on a range, interval, data or theme change. */
export const animates = (firstDraw: boolean, reducedMotion: boolean): boolean => firstDraw && !reducedMotion
