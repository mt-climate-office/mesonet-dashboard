import { describe, expect, it } from 'vitest'
import { groupByYear } from '../ag/compute'
import { annualAxisLabel } from '../ag/view/labels'
import { THEMES, yearColors } from '../palette'
import { MONTH_MID_DOY, MONTH_START_DOY, annualChart, annualTable, doyHeader, monthDay } from './agAnnual'
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
  it('axes: day of year 1–366, month ticks at the 1st and names mid-month, x axis at the bottom, plain cumulative y title', () => {
    type X = { type: string; min: number; max: number; axisLine: { onZero: boolean }; axisTick: { customValues: number[] }; axisLabel: { customValues: number[]; fontSize: number; formatter: (v: number) => string } }
    const o = annualChart(model, testCtx())
    const x = o.xAxis as X
    expect(x).toMatchObject({ type: 'value', min: 1, max: 366, axisLine: { onZero: false } })
    expect(x.axisTick.customValues).toEqual(MONTH_START_DOY)
    expect(x.axisLabel.customValues).toEqual(MONTH_MID_DOY)
    expect(MONTH_MID_DOY.slice(0, 2)).toEqual([17, 46])
    expect(MONTH_MID_DOY.map(x.axisLabel.formatter)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
    expect(o.yAxis).toMatchObject({ name: 'Cumulative rain (in)' })
    // Phones: every other month, 10 px labels, as the other phone axes.
    const phone = annualChart(model, testCtx('light', 390, true)).xAxis as X
    expect(phone.axisLabel.customValues.map(phone.axisLabel.formatter)).toEqual(['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'])
    expect(phone.axisLabel.fontSize).toBe(10)
  })
  type G = { x: number; y: number; children: { style: { text?: string; fill?: string; font?: string } }[] }
  const keys = (o: unknown) => ((o as { graphic: G[] }).graphic ?? []).map((g) => ({ text: g.children[1].style.text, fill: g.children[1].style.fill, font: g.children[1].style.font, x: g.x, y: g.y }))
  it('the years key is the station charts’ key row (graphics, no ECharts legend) at the top left of the plot', () => {
    const ctx = testCtx()
    const o = annualChart(model, ctx)
    const g = o.grid as { left: number; top: number }
    expect(o.legend).toBeUndefined()
    const row = keys(o)
    expect(row.map((k) => k.text)).toEqual(['2026', '2025', '2024'])
    expect(row[0].x).toBe(g.left)
    expect(new Set(row.map((k) => k.y)).size).toBe(1)
    expect(g.top).toBeGreaterThan(row[0].y)
    // The current year stands out: text color and bold; prior years muted.
    expect(row[0]).toMatchObject({ fill: ctx.theme.text })
    expect(row[0].font).toMatch(/^600 /)
    expect(row[1]).toMatchObject({ fill: ctx.theme.textMuted })
  })
  it('the years key wraps onto more rows, the current year first, then newest to oldest', () => {
    const many = Array.from({ length: 12 }, (_, i) => 2015 + i).flatMap((y) => groupByYear([`${y}-01-01`], [1]))
    const wide = annualChart({ ...model, traces: many }, testCtx('light', 1200))
    const phone = annualChart({ ...model, traces: many }, testCtx('light', 358, true))
    const row = keys(phone)
    expect(row[0].text).toBe('2026')
    expect(row.slice(1).map((k) => k.text)).toEqual(Array.from({ length: 11 }, (_, i) => String(2025 - i)))
    expect(new Set(row.map((k) => k.y)).size).toBeGreaterThan(1)
    expect(new Set(keys(wide).map((k) => k.y)).size).toBe(1)
    // The wrapped rows push the plot down.
    expect((phone.grid as { top: number }).top).toBeGreaterThan((wide.grid as { top: number }).top)
  })
  it('wind direction: compass ticks and small dots per year (the current year a little larger)', () => {
    const wind = groupByYear(['2025-01-01', '2025-01-02', '2026-01-03'], [350, 10, 20])
    const o = annualChart({ traces: wind, yLabel: 'Wind direction (°)', currentYear: 2026, variable: 'Wind Direction' }, testCtx())
    expect((o.yAxis as { axisLabel: { formatter: (v: number) => string } }).axisLabel.formatter(90)).toBe('E')
    const s = o.series as (S & { type: string; symbolSize: number })[]
    expect(s.map((x) => x.type)).toEqual(['scatter', 'scatter'])
    expect(s[0].data.map((p) => p[1])).toEqual([350, 10])
    expect(s[1].symbolSize).toBeGreaterThan(s[0].symbolSize)
    // Dots are keyed with a dot glyph.
    const g = (o as unknown as { graphic: G[] }).graphic
    expect(g.map((k) => (k.children[0].style as { text?: string }).text)).toEqual(['●', '●'])
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
