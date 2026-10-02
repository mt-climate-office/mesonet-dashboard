/**
 * Annual comparison: one line per calendar year on a day-of-year axis.
 * Prior years from batlow (old → new), the current year in --text-primary
 * at width 3. Traces arrive in display units (core/ag/view/derive#annualTraces).
 */
import type { EChartsOption } from 'echarts'
import type { AnnualTrace } from '../ag/compute'
import { ANNUAL_CURRENT, yearColors } from '../palette'
import { grid, valueAxis } from './axes'
import { MISSING, fmtNum } from './format'
import { lineSeries, points } from './series'
import { paint } from './theme'
import { axisTooltip, legend, tipText } from './tooltip'
import type { ChartBuilder, ChartTable } from './types'

export interface AnnualModel {
  traces: AnnualTrace[]
  /** y title, e.g. annualAxisLabel(header, cumulative). */
  yLabel: string
  currentYear: number
}

const sortedTraces = (m: AnnualModel) => [...m.traces].sort((a, b) => a.year - b.year)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Day of year of each month's 1st in a non-leap year: the x-axis month ticks. */
export const MONTH_START_DOY = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

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
    const s = lineSeries(String(t.year), points(t.doy, t.values, t.date.map(monthDay)), { color, width: isCurrent ? ANNUAL_CURRENT.width : 1.4 })
    return isCurrent ? { ...s, z: 3 } : s
  })
  return {
    grid: grid(ctx, { bottom: ctx.compact ? 52 : 56 }),
    // Month ticks at the 1st (non-leap DOY); the tooltip gives each year's exact date.
    xAxis: {
      type: 'value',
      min: 1,
      max: 366,
      splitLine: { show: false },
      axisTick: { customValues: MONTH_START_DOY },
      axisLabel: {
        customValues: MONTH_START_DOY,
        formatter: (v: number) => MONTHS[MONTH_START_DOY.indexOf(v)] ?? '',
        hideOverlap: true,
        fontFamily: ctx.theme.fontUi,
      },
    },
    yAxis: valueAxis(m.yLabel),
    legend: legend(ctx).legend,
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
