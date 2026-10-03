/**
 * Reference overlays: shaded bands (normals q25–q75, GDD projection range),
 * horizontal bands with corner labels (SWP field capacity / wilting point),
 * hatched sensor-change spans, labelled horizontal markLines (GDD stages) and
 * the diagonal hatch decal. Colors are palette roles resolved with `paint()`.
 */
import type { CustomSeriesOption, LineSeriesOption, MarkLineComponentOption } from 'echarts'
import type { Nullable } from '../ag/contract'
import { NORMALS, SENSOR_EVENT, SWP_BANDS, withAlpha } from '../palette'
import { AUX, lineSeries, points } from './series'
import { paint } from './theme'
import type { ChartContext } from './types'

/** ECharts decal: diagonal lines in `color` over the fill (the non-color channel for masks and events). */
export function hatchDecal(color: string) {
  return {
    symbol: 'rect',
    symbolSize: 1,
    dashArrayX: [1, 0],
    dashArrayY: [2, 4],
    rotation: -Math.PI / 4,
    color,
  }
}

/**
 * Shaded band between `lo` and `hi` as two stacked line series: an invisible
 * base at `lo` (id `aux:`, named `baseName`) and the fill of height hi − lo
 * named `name`. Each fill point carries the "lo–hi" text as its tooltip note.
 */
export function bandSeries(
  name: string,
  baseName: string,
  xs: number[],
  lo: Nullable[],
  hi: Nullable[],
  opts: { color: string; yAxisIndex?: number; digits?: number; stack: string },
): LineSeriesOption[] {
  const d = opts.digits ?? 0
  const width = xs.map((_, i) => (lo[i] != null && hi[i] != null ? hi[i]! - lo[i]! : null))
  const notes = xs.map((_, i) => (lo[i] != null && hi[i] != null ? `${lo[i]!.toFixed(d)}–${hi[i]!.toFixed(d)}` : ''))
  const common = { type: 'line' as const, stack: opts.stack, yAxisIndex: opts.yAxisIndex ?? 0, showSymbol: false, symbol: 'none', connectNulls: false, silent: true }
  return [
    { ...common, id: `${AUX}${opts.stack}-base`, name: baseName, data: points(xs, lo), lineStyle: { opacity: 0 } },
    {
      ...common,
      id: `${opts.stack}-band`,
      name,
      data: points(xs, width, notes),
      lineStyle: { opacity: 0 },
      areaStyle: { color: opts.color, opacity: 1 },
      color: opts.color,
    },
  ]
}

/** Climate normals overlay: q25–q75 band plus a dashed median line (palette NORMALS). */
export function normalsSeries(
  ctx: ChartContext,
  xs: number[],
  n: { q25: Nullable[]; median: Nullable[]; q75: Nullable[] },
  opts: { yAxisIndex?: number; digits?: number; label?: string } = {},
): LineSeriesOption[] {
  const label = opts.label ?? 'Normal'
  return [
    ...bandSeries(`${label} (25th–75th pct.)`, `${label} 25th percentile`, xs, n.q25, n.q75, {
      color: paint(ctx.theme, NORMALS.band),
      yAxisIndex: opts.yAxisIndex,
      digits: opts.digits,
      stack: 'normals',
    }),
    lineSeries(`${label} (median)`, points(xs, n.median), {
      color: paint(ctx.theme, NORMALS.line),
      width: 1.5,
      dash: NORMALS.dash,
      yAxisIndex: opts.yAxisIndex,
    }),
  ]
}

/**
 * Horizontal bands across the whole plot with corner labels, carried by an
 * invisible two-point line (id `aux:bands`) so they stay when legend items
 * are toggled. `y` values are in axis units; dashed lines mark the inner edges.
 */
export function hBandSeries(
  ctx: ChartContext,
  x: [number, number],
  bands: { from: number; to: number; label: string; labelAt: 'insideTopLeft' | 'insideBottomLeft' }[],
  lines: { y: number; label?: string }[],
): LineSeriesOption {
  const fill = paint(ctx.theme, SWP_BANDS.fill)
  const stroke = paint(ctx.theme, SWP_BANDS.line)
  return {
    type: 'line',
    id: `${AUX}bands`,
    name: `${AUX}bands`,
    data: [
      [x[0], lines[0]?.y ?? 1],
      [x[1], lines[0]?.y ?? 1],
    ],
    lineStyle: { opacity: 0 },
    showSymbol: false,
    silent: true,
    markArea: {
      silent: true,
      itemStyle: { color: fill },
      // Boxed corner labels, as legacy (AG-SWP-003: border 2, white at 0.8): kit text color
      // border and the surface at 0.8, so the band text reads over the data in every theme.
      label: {
        color: ctx.theme.text,
        fontFamily: ctx.theme.fontUi,
        fontSize: 14,
        fontWeight: 600,
        backgroundColor: ctx.theme.surface.startsWith('#') ? withAlpha(ctx.theme.surface, 0.8) : ctx.theme.surface,
        borderColor: ctx.theme.text,
        borderWidth: 2,
        padding: [3, 6],
      },
      data: bands.map((b) => [
        { yAxis: b.from, name: b.label, label: { position: b.labelAt } },
        { yAxis: b.to },
      ]),
    },
    markLine: {
      silent: true,
      symbol: 'none',
      lineStyle: { color: stroke, type: SWP_BANDS.dash, width: 1 },
      label: { show: false },
      data: lines.map((l) => ({ yAxis: l.y, name: l.label })),
    },
  }
}

/** One sensor-change span in wall-clock ms with its hover text. */
export interface EventSpan {
  x0: number
  x1: number
  text: string
}

/**
 * Hatched full-height spans for sensor changes (palette SENSOR_EVENT): a
 * custom series so the decal hatch applies. Hover shows the span's text.
 */
export function sensorEventSeries(ctx: ChartContext, spans: EventSpan[]): CustomSeriesOption {
  const fill = paint(ctx.theme, SENSOR_EVENT.fill)
  return {
    type: 'custom',
    id: `${AUX}sensor-events`,
    name: SENSOR_EVENT.label,
    data: spans.map((s) => [s.x0, s.x1, s.text]),
    encode: { x: [0, 1] },
    clip: true,
    z: 1,
    tooltip: { trigger: 'item', formatter: (p: { value?: unknown }) => String((p.value as unknown[])?.[2] ?? '') },
    renderItem: (params, api) => {
      const sys = params.coordSys as unknown as { x: number; y: number; width: number; height: number }
      const a = api.coord([api.value(0), 0])[0]
      const b = api.coord([api.value(1), 0])[0]
      return {
        type: 'rect',
        shape: { x: a, y: sys.y, width: Math.max(2, b - a), height: sys.height },
        style: { fill, decal: hatchDecal(ctx.theme.textMuted) },
      } as never
    },
  }
}

/**
 * Labelled horizontal markLines at `y` values (GDD growth stages on the
 * cumulative axis). Labels sit at the line's right end, above it, on the
 * chart surface, clear of the daily bars that fill the left of the plot.
 */
export function labelledLines(
  color: string,
  lines: { y: number; label: string }[],
  ctx: ChartContext,
): MarkLineComponentOption {
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color, type: 'dashed', width: 1 },
    label: {
      show: true,
      position: 'insideEndTop',
      formatter: '{b}',
      color: ctx.theme.textMuted,
      fontFamily: ctx.theme.fontUi,
      fontSize: ctx.compact ? 9 : 10,
      backgroundColor: ctx.theme.surface,
      padding: [1, 3],
    },
    data: lines.map((l) => ({ yAxis: l.y, name: l.label })),
  }
}
