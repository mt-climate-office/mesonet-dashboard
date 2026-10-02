/**
 * Downloader preview: small multiples, one grid per exported column
 * (core/models/downloaderPreview), stacked with a shared, linked x axis
 * and zoom. Lines cycle the palette's preview colors; gaps break lines.
 */
import type { EChartsOption, GridComponentOption, LineSeriesOption, XAXisComponentOption, YAXisComponentOption } from 'echarts'
import type { PreviewModel } from '../models/downloaderPreview'
import { PREVIEW_PANEL_PX } from '../models/downloaderPreview'
import { previewColor } from '../palette'
import { timeAxis, timeZoom } from './axes'
import { fmtWall, isoWall, MISSING } from './format'
import { lineSeries, points } from './series'
import { axisTooltip, tipText } from './tooltip'
import type { ChartBuilder, ChartTable } from './types'

/** Vertical layout inside each panel slot (PREVIEW_PANEL_PX tall), px. */
const TOP_PAD = 8
const TITLE_PX = 26
const XLABEL_PX = 24
/** Room under the last panel: the zoom slider on wide screens. */
const bottomPad = (compact: boolean) => (compact ? 8 : 44)

/** Canvas height (px) for `m`: one slot per panel plus padding; the chart grows, panels never squash. */
export function previewHeight(m: PreviewModel, compact: boolean): number {
  return TOP_PAD + m.panels.length * PREVIEW_PANEL_PX + bottomPad(compact)
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

  const grids: GridComponentOption[] = m.panels.map((_, i) => ({
    left,
    right,
    top: TOP_PAD + i * PREVIEW_PANEL_PX + TITLE_PX,
    height: plotH,
  }))
  const xAxes: XAXisComponentOption[] = m.panels.map((_, i) => {
    const base = timeAxis()
    const labels = m.monthlyTicks ? { ...base.axisLabel, formatter: { year: '{yyyy}', month: '{MMM} {yyyy}', day: '{MMM} {d}' } } : base.axisLabel
    return { ...base, gridIndex: i, axisLabel: labels } as XAXisComponentOption
  })
  const yAxes: YAXisComponentOption[] = m.panels.map((p, i) => ({
    type: 'value',
    gridIndex: i,
    scale: true,
    splitNumber: 4,
    // The panel title is the axis name, set left-aligned above the plot.
    name: p.column,
    nameLocation: 'end',
    nameGap: 10,
    nameTextStyle: { align: 'left', fontWeight: 600, width: Math.max(80, ctx.width - left - right), overflow: 'truncate' },
  }))
  const series: LineSeriesOption[] = m.panels.map((p, i) => {
    const s = lineSeries(p.column, points(m.x, p.values), { color: previewColor(i, ctx.theme.name), width: 1.5, yAxisIndex: i })
    return { ...s, xAxisIndex: i, showSymbol: m.markers, symbolSize: 5 }
  })
  const zoom = timeZoom(ctx).map((z) => (z.type === 'slider' ? { ...z, xAxisIndex: all, bottom: 10 } : { ...z, xAxisIndex: all }))

  return {
    useUTC: true,
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    dataZoom: n > 0 ? zoom : [],
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    tooltip: axisTooltip(ctx, (x) => header(x, m.period), (name, y) => tipText(name, fmtValue(y))),
    series,
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
