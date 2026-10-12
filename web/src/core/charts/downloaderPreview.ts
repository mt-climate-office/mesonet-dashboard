/**
 * Downloader preview: small multiples, one grid per exported column
 * (core/models/downloaderPreview), stacked with a shared, linked x axis
 * and zoom, in the house chart style (style.ts): lines cycle the palette's
 * preview colors, accumulations are bars, gaps break lines, the y axis follows
 * the variable's rule and the slider traces the first panel.
 */
import type { EChartsOption, GridComponentOption, SeriesOption, XAXisComponentOption, YAXisComponentOption } from 'echarts'
import type { PreviewModel } from '../models/downloaderPreview'
import { PREVIEW_PANEL_PX } from '../models/downloaderPreview'
import { previewColor } from '../palette'
import { latestVariableForColumn } from '../params'
import { timeAxis } from './axes'
import { fmtWall, isoWall, MISSING } from './format'
import { barSeries, lineSeries } from './series'
import { SLIDER, extentOf, isAccumulation, plotExtent, points, runningTotal, showsSlider, stepMs, timeZoom, valued, yAxisRange, zoomTrace } from './style'
import type { ChartContext } from './types'
import { axisTooltip, tipText } from './tooltip'
import type { ChartBuilder, ChartTable } from './types'

/** Vertical layout inside each panel slot (PREVIEW_PANEL_PX tall), px. */
const TOP_PAD = 8
const TITLE_PX = 26
const XLABEL_PX = 24
const DAY_MS = 86_400_000
/** A column's display variable ("Precipitation"), for the bar and y-axis rules. */
const variableOf = (column: string) => latestVariableForColumn(column) ?? ''

/** The x step, the plotted extent, the first panel's slider trace and whether the slider shows. */
function frame(m: PreviewModel, ctx: Pick<ChartContext, 'compact'>) {
  const step = stepMs(m.period, m.x)
  const bars = m.panels.some((p) => isAccumulation(variableOf(p.column)))
  const extent = plotExtent(m.x, step, bars)
  const first = m.panels[0]
  const trace = first ? points(m.x, isAccumulation(variableOf(first.column)) ? runningTotal(first.values) : first.values, step) : []
  return { step, extent, trace, slider: showsSlider(ctx, extent, valued(trace)) }
}

/** Room under the last panel: the zoom slider when it shows. */
const bottomPad = (slider: boolean) => (slider ? 2 * SLIDER.gap + SLIDER.height : SLIDER.gap)

/** Canvas height (px) for `m`: one slot per panel plus padding; the chart grows, panels never squash. */
export function previewHeight(m: PreviewModel, compact: boolean): number {
  return TOP_PAD + m.panels.length * PREVIEW_PANEL_PX + bottomPad(frame(m, { compact }).slider)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Tooltip header per period: "Jan 2026" / "Jan 1, 2026" / "Jan 1, 2026 14:00" (Mountain Time). */
function header(x: number, period: PreviewModel['period']): string {
  if (period !== 'monthly') return fmtWall(x, period)
  const d = new Date(x)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Up to 3 decimals, trailing zeros dropped (web/ `%{y:.3~f}`). */
const fmtValue = (v: number) => String(Number(v.toFixed(3)))

/** One stacked grid per panel; x axes linked through one dataZoom and the axis pointer. */
export const downloaderPreviewChart: ChartBuilder<PreviewModel> = (m, ctx) => {
  const n = m.panels.length
  const left = ctx.compact ? 52 : 64
  const right = 16
  const plotH = PREVIEW_PANEL_PX - TITLE_PX - XLABEL_PX
  const all = m.panels.map((_, i) => i)
  const f = frame(m, ctx)

  const grids: GridComponentOption[] = m.panels.map((_, i) => ({
    left,
    right,
    top: TOP_PAD + i * PREVIEW_PANEL_PX + TITLE_PX,
    height: plotH,
  }))
  const xAxes: XAXisComponentOption[] = m.panels.map((_, i) => {
    const base = timeAxis({ min: f.extent?.[0], max: f.extent?.[1], compact: ctx.compact })
    const labels = m.monthlyTicks ? { ...base.axisLabel, formatter: { year: '{MMM} {yyyy}', month: '{MMM} {yyyy}', day: '{MMM} {d}' } } : base.axisLabel
    // ≤ 36 months: one tick per month (legacy dtick M1); a 28–31 day interval pins ECharts to month steps.
    const ticks = m.monthlyTicks ? { minInterval: 28 * DAY_MS, maxInterval: 31 * DAY_MS } : {}
    return { ...base, ...ticks, gridIndex: i, axisLabel: labels } as XAXisComponentOption
  })
  const yAxes: YAXisComponentOption[] = m.panels.map((p, i) => ({
    type: 'value',
    gridIndex: i,
    ...yAxisRange(variableOf(p.column), ...extentOf(p.values)),
    // The panel title is the axis name, set left-aligned above the plot.
    name: p.column,
    nameLocation: 'end',
    nameGap: 10,
    nameTextStyle: { align: 'left', fontWeight: 600, width: Math.max(80, ctx.width - left - right), overflow: 'truncate' },
  }))
  const series: SeriesOption[] = m.panels.map((p, i) => {
    const color = previewColor(i, ctx.theme.name)
    const data = points(m.x, p.values, f.step)
    const s = isAccumulation(variableOf(p.column)) ? barSeries(p.column, data, color, i) : lineSeries(p.column, data, { color, yAxisIndex: i })
    return { ...s, xAxisIndex: i }
  })
  const trace = f.slider && n > 0 ? zoomTrace(f.trace, f.extent, { yAxisIndex: n }) : null
  const zoom = timeZoom(ctx, { xAxisIndex: all, extent: f.extent, slider: !!trace })

  return {
    useUTC: true,
    grid: grids,
    xAxis: xAxes,
    yAxis: trace ? [...yAxes, trace.yAxis] : yAxes,
    dataZoom: n > 0 ? zoom : [],
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    tooltip: axisTooltip(ctx, (x) => header(x, m.period), (name, y) => tipText(name, fmtValue(y))),
    series: trace ? [trace.series, ...series] : series,
  } satisfies EChartsOption
}

/** Table twin: one row per timestamp with any value (gap rows skipped), one column per panel. */
export function downloaderPreviewTable(m: PreviewModel): ChartTable {
  const first = m.period === 'hourly' ? 'Time (MT)' : m.period === 'monthly' ? 'Month' : 'Date'
  const rows: string[][] = []
  m.x.forEach((x, i) => {
    if (!m.panels.some((p) => p.values[i] != null)) return
    const t = isoWall(x, m.period === 'hourly' ? 'hourly' : 'daily')
    rows.push([m.period === 'monthly' ? t.slice(0, 7) : t, ...m.panels.map((p) => (p.values[i] == null ? MISSING : fmtValue(p.values[i]!)))])
  })
  return { caption: 'Preview of the requested data', columns: [first, ...m.panels.map((p) => p.column)], rows }
}
