/**
 * Wind rose (Latest top card): stacked polar bars of observation counts per
 * 16-point compass direction × speed bin (core/models/windRose), legacy
 * `plot_wind` / px.bar_polar. Bin colors are batlow via `binColors`, slow → fast.
 */
import type { EChartsOption } from 'echarts'
import type { WindRoseModel } from '../models/windRose'
import { binColors } from '../palette'
import { dateRangeText } from '../ag/view/summary'
import { escapeHtml } from './format'
import { tooltipBase } from './tooltip'
import type { ChartBuilder, ChartTable } from './types'

/** "Wind, Sep 19 – Oct 2" over the data's local dates (with the years when they differ), or null without dates. */
export function windRoseTitle(m: WindRoseModel): string | null {
  if (!m.span) return null
  const [a, b] = m.span
  const range = dateRangeText(a, b)
  return `Wind, ${a.slice(0, 4) === b.slice(0, 4) ? range.replace(/, \d{4}$/, '') : range}`
}

/** Legend / tooltip name of a bin: "4 – 6 mph". */
export const binName = (label: string): string => `${label} mph`

/** Only the 8 principal points are labelled (legacy tickvals 0, 45, … 315). */
const PRINCIPAL = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])

interface ItemParam {
  seriesName?: string
  name?: string
  value?: unknown
  marker?: unknown
}

export const windRoseChart: ChartBuilder<WindRoseModel> = (m, ctx) => {
  const colors = binColors(m.bins.length, ctx.theme.name)
  const names = m.bins.map((b) => binName(b.label))
  // One category spans 22.5°; start half a band past 12 o'clock so N is centred at the top.
  const startAngle = 90 + 360 / m.directions.length / 2
  return {
    // Room above for the "N" label under the card's title (it touched it at 390 px), and the bottom
    // ~quarter for the legend, which wraps to two rows in a narrow card.
    polar: { center: ['50%', '45%'], radius: '68%' },
    angleAxis: {
      type: 'category',
      data: [...m.directions],
      startAngle,
      clockwise: true,
      boundaryGap: true,
      axisTick: { show: false },
      axisLabel: { interval: 0, formatter: (v: string) => (PRINCIPAL.has(v) ? v : '') },
      splitLine: { show: false },
    },
    radiusAxis: {
      type: 'value',
      min: 0,
      splitNumber: 4,
      axisLabel: { fontSize: 9 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    // Plain (wrapping) legend, not the shared scroll legend: all 8 bins stay visible without paging.
    legend: { type: 'plain', data: names, bottom: 4, left: 'center', itemWidth: 12, itemHeight: 10, itemGap: 8, textStyle: { fontSize: ctx.compact ? 11 : 12 } },
    tooltip: {
      ...tooltipBase(ctx),
      trigger: 'item',
      formatter: ((p: ItemParam) =>
        `<div class="tooltip-name">${escapeHtml(p.seriesName ?? '')}</div>` +
        `<div>${typeof p.marker === 'string' ? p.marker : ''}${escapeHtml(p.name ?? '')}: ` +
        `<span style="font-family:var(--font-mono)">${escapeHtml(String(p.value ?? ''))}</span></div>`) as never,
    },
    series: m.bins.map((b, i) => ({
      type: 'bar',
      coordinateSystem: 'polar',
      name: names[i],
      stack: 'rose',
      data: [...b.counts],
      color: colors[i],
      // Thin surface-colored seams keep adjacent bins apart where colors are close.
      itemStyle: { borderColor: ctx.theme.surface, borderWidth: 0.5 },
      emphasis: { focus: 'series' },
      barCategoryGap: '4%',
    })),
  } satisfies EChartsOption
}

/** Table twin: one row per direction, one column per speed bin. */
export function windRoseTable(m: WindRoseModel): ChartTable {
  return {
    caption: `${windRoseTitle(m) ?? 'Wind data'}: observation counts by direction and speed`,
    columns: ['Direction', ...m.bins.map((b) => binName(b.label))],
    rows: m.directions.map((d, i) => [d, ...m.bins.map((b) => String(b.counts[i]))]),
  }
}
