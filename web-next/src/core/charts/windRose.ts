/**
 * The one wind rose: stacked polar bars of each 16-point compass direction ×
 * speed bin's percent of every reading (calm included, so roses of any window
 * or interval share one unit) (core/models/windRose), legacy `plot_wind` /
 * px.bar_polar. Bin colors are batlow via `binColors`, slow → fast. Two
 * layouts of the same option: `windRoseChart` (Now's 17 rem media card) and
 * `windRoseLargeChart` (the Wind direction page's Rose view, as large as the card allows).
 */
import type { EChartsOption } from 'echarts'
import { directionTotals, shareText, type WindRoseModel } from '../models/windRose'
import { CALM_MPH } from '../overview/summary'
import { binColors } from '../palette'
import { dateRangeText } from '../ag/view/summary'
import { escapeHtml } from './format'
import { tooltipBase } from './tooltip'
import type { ChartBuilder, ChartContext, ChartTable } from './types'

/**
 * "Wind, Sep 19 – Oct 2" over the data's local dates (with the years when they differ), or
 * "Wind, last 24 hours" for a rose of the last 24 hours (`last24h`); null without dates.
 */
export function windRoseTitle(m: WindRoseModel, last24h = false): string | null {
  if (last24h) return 'Wind, last 24 hours'
  if (!m.span) return null
  const [a, b] = m.span
  const range = dateRangeText(a, b)
  return `Wind, ${a.slice(0, 4) === b.slice(0, 4) ? range.replace(/, \d{4}$/, '') : range}`
}

/** Legend / tooltip name of a bin: "4 – 6 mph". */
export const binName = (label: string): string => `${label} mph`

/** Only the 8 principal points are labelled (legacy tickvals 0, 45, … 315). */
const PRINCIPAL = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])

/** The large layout puts the key beside the rose from this canvas width (px); narrower, under it. */
export const ROSE_SIDE_KEY_MIN_WIDTH = 560

interface ItemParam {
  seriesName?: string
  name?: string
  seriesIndex?: number
  dataIndex?: number
  marker?: unknown
}

/** `count` as a percent of every reading, calm included (the radius). */
const percentOf = (count: number, m: WindRoseModel): number => (m.n + m.calm ? (100 * count) / (m.n + m.calm) : 0)

/** The shared option; `layout` places the rose and its key. */
function roseOption(m: WindRoseModel, ctx: ChartContext, layout: { polar: object; legend: object }): EChartsOption {
  const colors = binColors(m.bins.length, ctx.theme.name)
  const names = m.bins.map((b) => binName(b.label))
  // One category spans 22.5°; start half a band past 12 o'clock so N is centred at the top.
  const startAngle = 90 + 360 / m.directions.length / 2
  return {
    polar: layout.polar,
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
      axisLabel: { fontSize: 9, formatter: '{value}%' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    // Plain (wrapping) legend, not the shared scroll legend: all 8 bins stay visible without paging.
    legend: { type: 'plain', data: names, itemWidth: 12, itemHeight: 10, itemGap: 8, textStyle: { fontSize: ctx.compact ? 11 : 12 }, ...layout.legend },
    tooltip: {
      ...tooltipBase(ctx),
      trigger: 'item',
      // The share, then the readings behind it (the series data holds percents; the model the counts).
      formatter: ((p: ItemParam) => {
        const count = m.bins[p.seriesIndex ?? -1]?.counts[p.dataIndex ?? -1]
        return (
          `<div class="tooltip-name">${escapeHtml(p.seriesName ?? '')}</div>` +
          `<div>${typeof p.marker === 'string' ? p.marker : ''}${escapeHtml(p.name ?? '')}: ` +
          (count === undefined
            ? ''
            : `<span style="font-family:var(--font-mono)">${shareText(count, m)}</span> (${count.toLocaleString('en-US')} ${count === 1 ? 'reading' : 'readings'})`) +
          `</div>`
        )
      }) as never,
    },
    series: m.bins.map((b, i) => ({
      type: 'bar',
      coordinateSystem: 'polar',
      name: names[i],
      stack: 'rose',
      data: b.counts.map((c) => percentOf(c, m)),
      color: colors[i],
      // Thin surface-colored seams keep adjacent bins apart where colors are close.
      itemStyle: { borderColor: ctx.theme.surface, borderWidth: 0.5 },
      emphasis: { focus: 'series' },
      barCategoryGap: '4%',
    })),
  } satisfies EChartsOption
}

/** Now's media card (17 rem tall, any width): the rose above, the key wrapping under it. */
export const windRoseChart: ChartBuilder<WindRoseModel> = (m, ctx) =>
  // Room above for the "N" label under the card's title (it touched it at 390 px), and the bottom
  // ~quarter for the legend, which wraps to two rows in a narrow card.
  roseOption(m, ctx, { polar: { center: ['50%', '44%'], radius: '64%' }, legend: { bottom: 4, left: 'center' } })

/**
 * The Rose view: from ROSE_SIDE_KEY_MIN_WIDTH the rose fills the height with the key in a column at
 * the right; narrower (a phone) it spans the width, its centre `width / 2 + 16` px down, so the
 * canvas must be about `width + 7 rem` tall (charts.css `.var-rose`) for the key's rows under it.
 */
export const windRoseLargeChart: ChartBuilder<WindRoseModel> = (m, ctx) =>
  ctx.width >= ROSE_SIDE_KEY_MIN_WIDTH
    ? roseOption(m, ctx, { polar: { center: ['50%', '50%'], radius: '80%' }, legend: { orient: 'vertical', right: 8, top: 'middle' } })
    : roseOption(m, ctx, { polar: { center: ['50%', Math.round(ctx.width / 2) + 16], radius: '86%' }, legend: { bottom: 4, left: 'center' } })

/**
 * Table twin: one row per direction (N first, not by time), one column per speed bin (its share of
 * every reading, as drawn), then the direction's share; the caption names the calm readings left out.
 */
export function windRoseTable(m: WindRoseModel, last24h = false): ChartTable {
  const totals = directionTotals(m)
  const calm = m.calm ? `; ${m.calm.toLocaleString('en-US')} calm readings (under ${CALM_MPH} mph, ${shareText(m.calm, m)}) are not drawn` : ''
  return {
    caption: `${windRoseTitle(m, last24h) ?? 'Wind data'}: share of readings by direction and speed${calm}`,
    columns: ['Direction', ...m.bins.map((b) => binName(b.label)), 'Share'],
    rows: m.directions.map((d, i) => [d, ...m.bins.map((b) => shareText(b.counts[i], m)), shareText(totals[i], m)]),
    fixedOrder: true,
  }
}
