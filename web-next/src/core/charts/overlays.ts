/**
 * Reference overlays: shaded bands (normals q25–q75, GDD projection range),
 * horizontal bands with corner labels (SWP field capacity / wilting point),
 * hatched sensor-change spans, labelled horizontal markLines (GDD stages) and
 * the diagonal hatch decal. Colors are palette roles resolved with `paint()`.
 */
import type { CustomSeriesOption, LineSeriesOption, MarkLineComponentOption } from 'echarts'
import type { Nullable } from '../ag/contract'
import { SENSOR_EVENT, SWP_BANDS, withAlpha } from '../palette'
import { AUX } from './series'
import { points } from './style'
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
 * The one band style (the daily low–high, gridMET normals, the GDD projection range): two stacked
 * line series, an invisible base at `lo` (id `aux:`, named `baseName`) and a fill of height
 * hi − lo named `name`, no outline, gaps broken at `step` (style `points`), drawn under its mean
 * line. Each fill point carries the "lo–hi" text as its tooltip note.
 */
export function bandSeries(
  name: string,
  baseName: string,
  xs: number[],
  lo: Nullable[],
  hi: Nullable[],
  opts: { color: string; yAxisIndex?: number; digits?: number; stack: string; step: number },
): LineSeriesOption[] {
  const d = opts.digits ?? 0
  const width = xs.map((_, i) => (lo[i] != null && hi[i] != null ? hi[i]! - lo[i]! : null))
  const notes = xs.map((_, i) => (lo[i] != null && hi[i] != null ? `${lo[i]!.toFixed(d)}–${hi[i]!.toFixed(d)}` : ''))
  const common = { type: 'line' as const, stack: opts.stack, yAxisIndex: opts.yAxisIndex ?? 0, smooth: false, showSymbol: false, symbol: 'none', connectNulls: false, silent: true, z: 1 }
  return [
    { ...common, id: `${AUX}${opts.stack}-base`, name: baseName, data: points(xs, lo, opts.step), lineStyle: { opacity: 0 } },
    {
      ...common,
      id: `${opts.stack}-band`,
      name,
      data: points(xs, width, opts.step, notes),
      lineStyle: { opacity: 0 },
      areaStyle: { color: opts.color, opacity: 1 },
      color: opts.color,
    },
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
 * cumulative axis). Labels sit just past the line's right end, outside the
 * plot (the builder leaves a gutter there), so they never cover the data;
 * with `labels: false` the lines go unlabelled (the tooltip names them).
 */
export function labelledLines(
  color: string,
  lines: { y: number; label: string }[],
  ctx: ChartContext,
  opts: { labels?: boolean; fontSize?: number } = {},
): MarkLineComponentOption {
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color, type: 'dashed', width: 1 },
    label: {
      show: opts.labels ?? true,
      position: 'end',
      distance: 6,
      formatter: '{b}',
      color: ctx.theme.textMuted,
      fontFamily: ctx.theme.fontUi,
      fontSize: opts.fontSize ?? 10,
    },
    data: lines.map((l) => ({ yAxis: l.y, name: l.label })),
  }
}
