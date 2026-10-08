/**
 * Annual comparison: one line per calendar year on a day-of-year axis.
 * Prior years from batlow (old → new), the current year in --text-primary
 * at width 3. Axes as every time chart's (mono labels, 10 px on phones, the
 * x axis at the bottom); the years' key at the top left, where the station
 * charts put theirs: a plain legend that wraps (never paged), the current year
 * first. Wind direction draws dots (windDirection.ts). Traces arrive in display
 * units (core/ag/view/derive#annualTraces).
 */
import type { EChartsOption, YAXisComponentOption } from 'echarts'
import type { AnnualTrace } from '../ag/compute'
import { ANNUAL_CURRENT, yearColors } from '../palette'
import { grid, valueAxis } from './axes'
import { WIND_DIRECTION } from '../variables/direction'
import { MISSING, fmtNum } from './format'
import { lineSeries } from './series'
import { LINE_WIDTH, bottomLayout, extentOf, points, stepMs, yAxisRange } from './style'
import { LEGEND_ROW, legendRows } from './agLegend'
import { paint } from './theme'
import { axisTooltip, tipText } from './tooltip'
import type { ChartBuilder, ChartTable } from './types'
import { DIRECTION_DOT, compassTick, directionDots } from './windDirection'

export interface AnnualModel {
  traces: AnnualTrace[]
  /** y title, e.g. annualAxisLabel(header, cumulative). */
  yLabel: string
  currentYear: number
  /** The display variable ("Air Temperature"), for the y-axis rule (style `yBounds`); a cumulative total is zero-based. */
  variable?: string
}

/** The legend's first row above the plot (px); each wrapped row adds agLegend LEGEND_ROW. */
const LEGEND_ROW_PX = 26
/** Legend marks (px) and the gap between items. */
const ITEM_W = 16
const ITEM_GAP = 10

const sortedTraces = (m: AnnualModel) => [...m.traces].sort((a, b) => a.year - b.year)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Day of year of each month's 1st in a non-leap year: the x-axis month ticks. */
export const MONTH_START_DOY = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

/**
 * Each month's middle day of year: where its label sits, between its ticks, so "Jan" never sits on
 * the y axis beside its lowest label.
 */
export const MONTH_MID_DOY = MONTH_START_DOY.map((d, i) => Math.round((d + (MONTH_START_DOY[i + 1] ?? 366)) / 2))

/** "2024-02-29" → "Feb 29": the trace's own calendar date, so leap years read correctly. */
export const monthDay = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`

/** Shared tooltip header: day of year only, since the same DOY is a different date in leap years. */
export const doyHeader = (doy: number) => `Day ${Math.round(doy)}`

export const annualChart: ChartBuilder<AnnualModel> = (m, ctx) => {
  const traces = sortedTraces(m)
  const prior = traces.filter((t) => t.year !== m.currentYear)
  const colors = yearColors(prior.length, ctx.theme.name)
  const current = paint(ctx.theme, ANNUAL_CURRENT.color)
  const series = traces.map((t) => {
    const isCurrent = t.year === m.currentYear
    const color = isCurrent ? current : colors[prior.indexOf(t)]
    // One line width; the current year is the design's one highlight (ANNUAL_CURRENT).
    const pts = points(t.doy, t.values, stepMs('doy'), t.date.map(monthDay))
    const s =
      m.variable === WIND_DIRECTION
        ? directionDots(String(t.year), pts, { color, size: isCurrent ? DIRECTION_DOT + 2 : DIRECTION_DOT })
        : lineSeries(String(t.year), pts, { color, width: isCurrent ? ANNUAL_CURRENT.width : LINE_WIDTH })
    return isCurrent ? { ...s, z: 3 } : s
  })
  const fontSize = ctx.compact ? 10 : 11
  // The current year leads the key, so it is on the first row however many years wrap below it.
  const keyed = [...traces.filter((t) => t.year === m.currentYear), ...prior].map((t) => String(t.year))
  const base = grid(ctx, { bottom: bottomLayout(false).grid })
  // ECharts pads the legend 5 px a side.
  const avail = ctx.width - (base.left as number) - (base.right as number) - 10
  const rows = legendRows(keyed.map((y) => ITEM_W + 5 + Math.ceil(y.length * fontSize * 0.6)), avail, ITEM_GAP)
  const g = { ...base, top: LEGEND_ROW_PX + 6 + Math.max(0, rows - 1) * LEGEND_ROW }
  // Phones label every other month.
  const labelled = MONTH_MID_DOY.filter((_, i) => !ctx.compact || i % 2 === 0)
  return {
    // No zoom: a calendar year is the whole axis.
    grid: g,
    // Month ticks at the 1st (non-leap DOY), names mid-month; the tooltip gives each year's exact date.
    xAxis: {
      type: 'value',
      min: 1,
      max: 366,
      splitLine: { show: false },
      axisLine: { onZero: false },
      axisTick: { customValues: MONTH_START_DOY },
      axisLabel: {
        customValues: labelled,
        formatter: (v: number) => MONTHS[MONTH_MID_DOY.indexOf(v)] ?? '',
        hideOverlap: true,
        fontSize,
      },
    },
    yAxis: {
      ...valueAxis(m.yLabel),
      ...yAxisRange(m.variable ?? '', ...extentOf(...traces.map((t) => t.values))),
      nameGap: ctx.compact ? 36 : 46,
      nameTextStyle: { fontSize },
      axisLabel: { fontSize, ...(m.variable === WIND_DIRECTION ? { formatter: compassTick } : {}) },
    } as YAXisComponentOption,
    // The years' key: a row at the top left, as the station charts' keys.
    legend: { type: 'plain', top: 0, left: g.left as number, right: g.right as number, data: keyed, itemWidth: ITEM_W, itemHeight: 10, itemGap: ITEM_GAP, textStyle: { fontSize } },
    tooltip: axisTooltip(ctx, doyHeader, (name, y, date) => tipText(date ? `${name} (${date})` : name, y.toFixed(2))),
    series,
  } satisfies EChartsOption
}

export function annualTable(m: AnnualModel): ChartTable {
  const traces = sortedTraces(m)
  const doys = [...new Set(traces.flatMap((t) => t.doy))].sort((a, b) => a - b)
  const byYear = traces.map((t) => new Map(t.doy.map((d, i) => [d, t.values[i]])))
  return {
    caption: `${m.yLabel} by day of year and year`,
    columns: ['Day of year', ...traces.map((t) => String(t.year))],
    rows: doys.map((d) => [String(d), ...byYear.map((y) => (y.has(d) ? fmtNum(y.get(d), 2) : MISSING))]),
  }
}
