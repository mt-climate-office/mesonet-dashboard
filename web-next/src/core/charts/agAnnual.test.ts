import { describe, expect, it } from 'vitest'
import { groupByYear } from '../ag/compute'
import { annualAxisLabel } from '../ag/view/labels'
import { THEMES, yearColors } from '../palette'
import { MONTH_START_DOY, annualChart, annualTable, doyHeader, monthDay } from './agAnnual'
import { testCtx } from './testing'

type S = { name: string; color: string; lineStyle: { width: number; color: string }; data: unknown[][] }

const traces = [2026, 2024, 2025].flatMap((y) => groupByYear([`${y}-01-01`, `${y}-01-02`], [1, 2], { cumulative: true }))
const model = { traces, yLabel: annualAxisLabel('Total Precipitation [in]', true), currentYear: 2026 }

describe('annualChart', () => {
  it('one line per year sorted; current year --text-primary width 3; prior years batlow', () => {
    for (const t of THEMES) {
      const ctx = testCtx(t)
      const o = annualChart(model, ctx)
      const s = o.series as S[]
      expect(s.map((x) => x.name)).toEqual(['2024', '2025', '2026'])
      expect(s[2].lineStyle).toMatchObject({ width: 3, color: ctx.theme.vars['--text-primary'] })
      expect(s.slice(0, 2).map((x) => x.color)).toEqual(yearColors(2, t))
      expect(s[0].data).toEqual([[1, 1, 'Jan 1'], [2, 3, 'Jan 2']])
    }
  })
  it('axes: day of year 1–366 with month ticks at the 1st, legacy cumulative y title', () => {
    const o = annualChart(model, testCtx())
    const x = o.xAxis as { type: string; min: number; max: number; axisLabel: { customValues: number[]; formatter: (v: number) => string } }
    expect(x).toMatchObject({ type: 'value', min: 1, max: 366 })
    expect(x.axisLabel.customValues).toEqual(MONTH_START_DOY)
    expect(MONTH_START_DOY.map(x.axisLabel.formatter)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
    expect(o.yAxis).toMatchObject({ name: 'Annual Cumulative Precipitation [in]' })
  })
  it('tooltip: DOY-only header; each year shows its own (leap-aware) date', () => {
    const leap = groupByYear(['2024-02-29', '2024-03-01'], [1, 2])
    const flat = groupByYear(['2025-03-01'], [5])
    const o = annualChart({ traces: [...leap, ...flat], yLabel: 'x', currentYear: 2025 }, testCtx())
    const s = o.series as S[]
    expect(s[0].data[1]).toEqual([61, 2, 'Mar 1'])
    expect(s[1].data[0]).toEqual([60, 5, 'Mar 1'])
    expect(doyHeader(366)).toBe('Day 366')
    expect(monthDay('2024-02-29')).toBe('Feb 29')
    const html = (o.tooltip as { formatter: (p: unknown) => string }).formatter([
      { seriesName: '2024', seriesId: 'a', value: [60, 1, 'Feb 29'], axisValue: 60 },
      { seriesName: '2025', seriesId: 'b', value: [60, 5, 'Mar 1'], axisValue: 60 },
    ])
    expect(html).toContain('Day 60<')
    expect(html).toContain('2024 (Feb 29)')
    expect(html).toContain('2025 (Mar 1)')
  })
  it('table: one column per year, one row per day of year', () => {
    const t = annualTable(model)
    expect(t.columns).toEqual(['Day of year', '2024', '2025', '2026'])
    expect(t.rows).toEqual([['1', '1.00', '1.00', '1.00'], ['2', '3.00', '3.00', '3.00']])
  })
})
