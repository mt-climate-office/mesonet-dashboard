/**
 * The variable page's chart (Charts → `v=`): one variable, drawn by the
 * Compare panel logic (latestTimeseries.ts: lines or bars, soil depths,
 * normals, sensor-change spans, touch modes), with its plot filling the host's
 * height instead of a fixed panel height. On the Daily interval a one-column
 * variable also gets its daily low–high band (core/variables/band) behind the
 * mean line, named in the tooltip. The host sets the height in CSS: 420 px,
 * `min(60dvh, 420px)` on phones (styles/charts.css).
 */
import type { EChartsOption, SeriesOption, YAXisComponentOption } from 'echarts'
import { DAILY_RANGE, withAlpha } from '../palette'
import { timeseriesInUnits } from '../models/timeseries'
import { displayUnit } from '../units'
import { plainUnit } from '../variables/labels'
import { LAYOUT, depthLabels, latestTimeseriesChart, latestTimeseriesTable, seriesColor, type DepthEnd, type LatestTimeseriesModel } from './latestTimeseries'
import { bandSeries } from './overlays'
import { AUX } from './series'
import { DAY, bottomLayout } from './style'
import { tipText, type TipParam } from './tooltip'
import type { ChartBuilder, ChartContext, ChartTable } from './types'

/** A LatestTimeseriesModel with exactly one panel. */
export type VariableModel = LatestTimeseriesModel

const BAND_ID = 'daily-range'

export const variableChart: ChartBuilder<VariableModel> = (model, ctx) => {
  const option = latestTimeseriesChart(model, ctx)
  // The band below is drawn here from the model too: in the display units, as latestTimeseries draws.
  const m = { ...model, ts: timeseriesInUnits(model.ts) }
  const [g] = option.grid as { left: number; right: number }[]
  const panel = m.ts.panels[0]
  const s = panel?.series.length === 1 ? panel.series[0] : undefined
  // Room under the plot for the x labels, and the slider when it shows (style `bottomLayout`).
  const slider = (option.dataZoom as { type?: string }[]).some((z) => z.type === 'slider')
  const bottom = bottomLayout(slider).grid
  const out: EChartsOption = {
    ...option,
    grid: [{ left: g.left, right: g.right, top: LAYOUT.top, bottom }],
    // The plot fills the host's height, not the stack's panel height: respace the depth labels for it.
    ...(ctx.height ? { series: respaceDepthLabels(option, ctx, ctx.height - LAYOUT.top - bottom) } : {}),
  }
  if (!s?.band) return out

  // The one band style (overlays `bandSeries`): the line's color at DAILY_RANGE alpha, under the mean line.
  const ok = m.ts.x.map(Number.isFinite)
  const pick = <T>(a: readonly T[]) => a.filter((_, j) => ok[j])
  // Daily rows sit at local noon, as latestTimeseries draws them.
  const xs = pick(m.ts.x).map((x) => x + 12 * 3_600_000)
  const color = withAlpha(seriesColor(ctx, panel, s, 0), DAILY_RANGE.alpha)
  const band = bandSeries(DAILY_RANGE.label, `${AUX}${BAND_ID}-base`, xs, pick(s.band.lo), pick(s.band.hi), { color, digits: 1, stack: BAND_ID, step: DAY })
  const unit = plainUnit(displayUnit(/\[([^\]]+)\]\s*$/.exec(s.name)?.[1] ?? '', s.name))
  const base = (option.tooltip as { formatter: (p: TipParam | TipParam[]) => string }).formatter
  const formatter = (raw: TipParam | TipParam[]) => {
    const fill = (Array.isArray(raw) ? raw : [raw]).find((p) => p.seriesId === `${BAND_ID}-band`)
    const note = Array.isArray(fill?.value) && typeof fill.value[2] === 'string' ? fill.value[2] : ''
    return base(raw) + (note ? `<div>${tipText('Low–high', `${note}${unit ? ` ${unit}` : ''}`)}</div>` : '')
  }
  return {
    ...out,
    tooltip: { ...(option.tooltip as object), formatter: formatter as never },
    series: [...(out.series as SeriesOption[]), ...band],
  }
}

/** The option's series with its depth labels (latestTimeseries `depthLabels`) spaced for a plot `plotPx` tall. */
function respaceDepthLabels(option: EChartsOption, ctx: ChartContext, plotPx: number): SeriesOption[] {
  const series = option.series as SeriesOption[]
  return series.map((x) => {
    if (x.type !== 'scatter' || !String(x.id ?? '').endsWith('-depth-labels')) return x
    const data = x.data as { value: [number, number, number]; label: { formatter: string; color: string; fontSize: number } }[]
    const ends: DepthEnd[] = data.map((d) => ({ x: d.value[0], y: d.value[2], text: d.label.formatter, color: d.label.color }))
    return depthLabels(ends, 0, data[0]?.label.fontSize ?? 12, ctx, (option.yAxis as YAXisComponentOption[])[0] as { min?: unknown; max?: unknown }, plotPx)
  })
}

/** At most `n` intervals on a fixed-interval y axis: the step grows by whole multiples, the top rounds up to a tick. */
function sparseTicks(y: Record<string, unknown>, n: number): Record<string, unknown> {
  const { min, max, interval } = y as { min?: unknown; max?: unknown; interval?: unknown }
  if (typeof min !== 'number' || typeof max !== 'number' || typeof interval !== 'number' || interval <= 0) return y
  const k = Math.ceil(Math.round((max - min) / interval) / n)
  if (k <= 1) return y
  const step = interval * k
  return { ...y, interval: step, max: min + Math.ceil((max - min) / step - 1e-9) * step }
}

/**
 * The dashboard's stacks (core/dashboard `stackColumns`): Compare's panels on one shared time axis
 * (one tooltip for every panel), drawn compact, in the model's `fill` rows (equal, aligned with the
 * other stack's; one row each without it), at most 3 y intervals each, no y titles (the panel links name them).
 */
export const dashboardStackChart: ChartBuilder<LatestTimeseriesModel> = (m, ctx) => {
  // No depth keys: every depth is named at its line's end, and the panel links sit where the key row would.
  const option = latestTimeseriesChart({ ...m, fill: m.fill ?? { rows: m.ts.panels.length }, depthKeys: false }, { ...ctx, compact: true })
  // No y titles: each panel's link over it names it with its unit ("Pressure 846 mb"), and a title beside
  // wide tick labels ("852.5") would crowd the card's edge.
  return { ...option, yAxis: (option.yAxis as Record<string, unknown>[]).map((y) => ({ ...sparseTicks(y, 3), name: '' })) } as EChartsOption
}

/** The sr-only twin (first 500 rows), as Compare's; daily low and high columns with a band. */
export const variableTable = (m: VariableModel): ChartTable => latestTimeseriesTable(m)

/** Every row, for the visible table view (paged by core/variables `tablePage`). */
export const variableTableAll = (m: VariableModel): ChartTable => latestTimeseriesTable(m, Infinity)
