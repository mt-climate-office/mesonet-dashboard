/**
 * Heatmap helpers: a continuous color bar (visualMap) with labelled ticks
 * drawn beside it — min, max, and the palette's `midpointLabel` for diverging
 * scales — and the hatched frozen-cell layer. The bar is drawn as graphics in
 * px from ctx.width (the visualMap only maps colors), so ticks line up exactly.
 */
import type { CustomSeriesOption, GraphicComponentOption, VisualMapComponentOption } from 'echarts'
import { FROZEN, type HeatmapScale } from '../palette'
import { hatchDecal } from './overlays'
import type { ChartContext } from './types'

export interface ColorBarTick {
  /** Position in the visualMap's units (log10 for a log scale). */
  value: number
  label: string
}

export interface ColorBar {
  visualMap: VisualMapComponentOption
  graphic: GraphicComponentOption[]
  /** Grid right margin that clears the bar and its labels. */
  gridRight: number
}

const BAR_W = 12
const TOP = 36
const CHAR_W = 6.4 // ~11 px mono

/**
 * Color bar for `scale` over the data extent `[lo, hi]` (axis units). A
 * diverging scale (`midpoint` given) is centred on the midpoint so the
 * neutral stop sits there; the midpoint gets `scale.midpointLabel`.
 * Extra `ticks` (e.g. field capacity) are labelled too; any label closer than
 * 12 px to an earlier one is dropped (midpoint and extra ticks win over min/max).
 */
export function colorBar(
  ctx: ChartContext,
  scale: HeatmapScale,
  extent: [number, number],
  opts: { title: string; midpoint?: number; ticks?: ColorBarTick[]; fmt: (v: number) => string; seriesIndex: number },
): ColorBar {
  let [min, max] = extent
  if (opts.midpoint !== undefined) {
    const half = Math.max(opts.midpoint - min, max - opts.midpoint, 1e-6)
    min = opts.midpoint - half
    max = opts.midpoint + half
  }
  if (min === max) {
    min -= 0.5
    max += 0.5
  }
  const barH = ctx.compact ? 120 : 170
  const wanted: ColorBarTick[] = [
    ...(opts.midpoint !== undefined && scale.midpointLabel ? [{ value: opts.midpoint, label: scale.midpointLabel }] : []),
    ...(opts.ticks ?? []).filter((t) => t.value >= min && t.value <= max),
    { value: max, label: opts.fmt(max) },
    { value: min, label: opts.fmt(min) },
  ]
  const yOf = (v: number) => TOP + (barH * (max - v)) / (max - min)
  const ticks: ColorBarTick[] = []
  for (const t of wanted) if (ticks.every((k) => Math.abs(yOf(k.value) - yOf(t.value)) >= 12)) ticks.push(t)

  const labelW = Math.ceil(Math.max(...ticks.map((t) => t.label.length)) * CHAR_W) + 6
  const barX = ctx.width - 8 - labelW - 6 - BAR_W
  const n = scale.colors.length
  const graphic: GraphicComponentOption[] = [
    {
      type: 'text',
      right: 8,
      top: 10,
      silent: true,
      style: { text: opts.title, fill: ctx.theme.textMuted, font: `12px ${ctx.theme.fontUi}`, align: 'right' },
    },
    {
      // The bar itself: the same stops the visualMap maps through, bottom (min) → top (max).
      type: 'rect',
      silent: true,
      shape: { x: barX, y: TOP, width: BAR_W, height: barH },
      style: {
        fill: {
          type: 'linear',
          x: 0,
          y: 1,
          x2: 0,
          y2: 0,
          colorStops: scale.colors.map((color, i) => ({ offset: i / (n - 1), color })),
        },
        stroke: ctx.theme.grid,
      },
    } as GraphicComponentOption,
    ...ticks.flatMap((t): GraphicComponentOption[] => [
      {
        type: 'line',
        silent: true,
        // Across the bar, so the mark is not read as a minus sign beside the label.
        shape: { x1: barX, y1: yOf(t.value), x2: barX + BAR_W + 3, y2: yOf(t.value) },
        style: { stroke: ctx.theme.text, lineWidth: 1.5 },
      },
      {
        type: 'text',
        silent: true,
        x: barX + BAR_W + 6,
        y: yOf(t.value),
        style: { text: t.label, fill: ctx.theme.textMuted, font: `11px ${ctx.theme.fontMono}`, verticalAlign: 'middle' },
      },
    ]),
  ]
  return {
    // Hidden: it only maps values to colors; the bar above is drawn as graphics so ticks line up exactly.
    visualMap: {
      type: 'continuous',
      show: false,
      min,
      max,
      dimension: 2,
      seriesIndex: opts.seriesIndex,
      inRange: { color: [...scale.colors] },
    },
    graphic,
    gridRight: ctx.width - barX + 12,
  }
}

/**
 * Frozen-soil cells on category axes as a custom series: flat FROZEN fill
 * plus the hatch decal, so the mask reads without color. `cells` are
 * [xIndex, yIndex].
 */
export function frozenSeries(ctx: ChartContext, name: string, cells: [number, number][]): CustomSeriesOption {
  const fill = FROZEN[ctx.theme.name].color
  return {
    type: 'custom',
    name,
    data: cells,
    encode: { x: 0, y: 1 },
    color: fill,
    itemStyle: { color: fill },
    renderItem: (_params, api) => {
      const c = api.coord([api.value(0), api.value(1)])
      const s = api.size?.([1, 1]) as number[]
      return {
        type: 'rect',
        shape: { x: c[0] - s[0] / 2, y: c[1] - s[1] / 2, width: s[0], height: s[1] },
        style: { fill, decal: hatchDecal(ctx.theme.textMuted) },
      } as never
    },
  }
}
