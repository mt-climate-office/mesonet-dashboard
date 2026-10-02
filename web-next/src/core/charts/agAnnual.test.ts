import { describe, expect, it } from 'vitest'
import { groupByYear } from '../ag/compute'
import { annualAxisLabel } from '../ag/view/labels'
import { THEMES, yearColors } from '../palette'
import { annualChart, annualTable } from './agAnnual'
import { testCtx } from './testing'

type S = { name: string; color: string; lineStyle: { width: number; color: string }; data: number[][] }

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
      expect(s[0].data).toEqual([[1, 1], [2, 3]])
    }
  })
  it('axes: day of year 1–366, legacy cumulative y title', () => {
    const o = annualChart(model, testCtx())
    expect(o.xAxis).toMatchObject({ type: 'value', min: 1, max: 366, name: 'Day of Year' })
    expect(o.yAxis).toMatchObject({ name: 'Annual Cumulative Precipitation [in]' })
  })
  it('table: one column per year, one row per day of year', () => {
    const t = annualTable(model)
    expect(t.columns).toEqual(['Day of year', '2024', '2025', '2026'])
    expect(t.rows).toEqual([['1', '1.00', '1.00', '1.00'], ['2', '3.00', '3.00', '3.00']])
  })
})
