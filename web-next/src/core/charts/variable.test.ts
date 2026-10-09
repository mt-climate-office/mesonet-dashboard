import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { buildTimeseriesModel } from '../models/timeseries'
import { THEMES, variableStyle } from '../palette'
import { LAYOUT, fillRows, latestTimeseriesChart } from './latestTimeseries'
import { DAY, ZOOM_TRACE_ID, bottomLayout } from './style'
import { drawn, testCtx } from './testing'
import { dashboardStackChart, variableChart, variableTable, variableTableAll, type VariableModel } from './variable'

const view: [number, number] = [Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 2)]
const rows = (n: number): ObservationRow[] =>
  Array.from({ length: n }, (_, i) => ({
    station: 'acebozem',
    datetime: `2026-07-${String(1 + Math.floor(i / 24)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:00:00-06:00`,
    'Air Temperature @ 2 m [°F]': 60 + (i % 24),
    'Relative Humidity [%]': 50,
  })) as ObservationRow[]
const model = (n = 24, vars = ['Air Temperature'], v: [number, number] = view): VariableModel => ({
  ts: buildTimeseriesModel({ rows: rows(n), vars, period: 'hourly' })!,
  period: 'hourly',
  view: v,
})

const week = model(168, ['Air Temperature'], [view[0], view[0] + 7 * DAY])

type Opt = { grid: Record<string, number>[]; series: { type: string; color: string }[]; dataZoom: { type: string; disabled?: boolean; startValue?: number; endValue?: number }[]; tooltip: { triggerOn?: string } }

describe('variableChart', () => {
  it('draws the Compare panel for one variable, its plot filling the host height', () => {
    for (const theme of THEMES) {
      const o = variableChart(model(), testCtx(theme)) as unknown as Opt
      expect(o.grid).toHaveLength(1)
      // 24 h: no slider, so only the x labels sit under the plot.
      expect(o.grid[0]).toMatchObject({ top: LAYOUT.top, bottom: bottomLayout(false).grid })
      expect(o.grid[0].height).toBeUndefined()
      expect(o.series[0]).toMatchObject({ type: 'line', color: variableStyle('Air Temperature', theme)!.color })
    }
    expect((variableChart(week, testCtx('dark')) as unknown as Opt).grid[0].bottom).toBe(LAYOUT.bottom)
    expect((variableChart(model(), testCtx('dark', 390, true)) as unknown as Opt).grid[0].bottom).toBe(LAYOUT.compactBottom)
  })
  it('touch: swipes scroll (inside zoom disabled), taps show the tooltip', () => {
    const o = variableChart(model(), testCtx('dark', 390, true, true)) as unknown as Opt
    expect(o.dataZoom).toEqual([expect.objectContaining({ type: 'inside', disabled: true })])
    expect(o.tooltip.triggerOn).toBe('click')
  })
  it("the x axis is the shown window, so the slider's track matches the chart (no empty zoom-out padding)", () => {
    const o = variableChart(week, testCtx('dark')) as unknown as Opt & { xAxis: { min: number; max: number }[]; series: { id?: string; data: unknown[][] }[] }
    expect(o.xAxis[0]).toMatchObject({ min: week.view[0], max: week.view[1] })
    const slider = o.dataZoom.find((z) => z.type === 'slider')
    expect([slider?.startValue, slider?.endValue]).toEqual([o.xAxis[0].min, o.xAxis[0].max])
    // Its trace (the main line) is padded to the same ends.
    const trace = o.series[0]
    expect(trace.id).toBe(ZOOM_TRACE_ID)
    expect([trace.data[0][0], trace.data.at(-1)![0]]).toEqual(week.view)
  })
  it('no slider at 24 h', () => {
    expect((variableChart(model(), testCtx('dark')) as unknown as Opt).dataZoom.map((z) => z.type)).toEqual(['inside'])
  })
  it('compact tooltip: no panel sub-header for one variable', () => {
    const o = variableChart(model(), testCtx('dark')) as unknown as { tooltip: { formatter: (p: unknown) => string } }
    const html = o.tooltip.formatter([{ seriesId: 'p0:Air Temperature @ 2 m [°F]', value: [view[0], 61], axisValue: view[0], marker: '' }])
    expect(html).toContain('61 °F')
    expect(html).not.toContain('tooltip-sub')
  })
  it('daily with a band: a low–high fill behind the line, named in the tooltip and tabled', () => {
    const m = model(24)
    const s = m.ts.panels[0].series[0]
    const banded: VariableModel = { ...m, period: 'daily', ts: { ...m.ts, panels: [{ ...m.ts.panels[0], series: [{ ...s, band: { lo: s.values.map((v) => v! - 5), hi: s.values.map((v) => v! + 5) } }] }] } }
    const o = variableChart(banded, testCtx('light')) as unknown as { series: { id: string; z?: number }[]; tooltip: { formatter: (p: unknown) => string } }
    const s2 = drawn<{ id: string; z?: number }>(o)
    expect(s2.map((x) => x.id)).toEqual([expect.stringContaining('Air Temperature'), 'aux:daily-range-base', 'daily-range-band'])
    expect(s2[2].z).toBe(1)
    const html = o.tooltip.formatter([
      { seriesId: 'p0:Air Temperature @ 2 m [°F]', value: [view[0], 61], axisValue: view[0], marker: '' },
      { seriesId: 'daily-range-band', value: [view[0], 10, '55.0–65.0'], axisValue: view[0] },
    ])
    expect(html).toContain('Low–high')
    expect(html).toContain('55.0–65.0 °F')
    expect(variableTable(banded).columns).toEqual(['Date', 'Air temperature (°F)', 'Low: Air temperature (°F)', 'High: Air temperature (°F)'])
    expect(drawn(variableChart(model(), testCtx('light')))).toHaveLength(1)
  })
  it('the y axis spans the band from its real low and high, not the stacked sums', () => {
    const m = model(24)
    const s = m.ts.panels[0].series[0]
    // Lows near −15, highs near 100: the stacked fill is drawn as low + (high − low), so its sum would read 100 + … if mistaken.
    const banded: VariableModel = { ...m, period: 'daily', ts: { ...m.ts, panels: [{ ...m.ts.panels[0], series: [{ ...s, band: { lo: s.values.map(() => -15.34), hi: s.values.map(() => 100.166) } }] }] } }
    const [y] = (variableChart(banded, testCtx('light')) as unknown as { yAxis: { min: number; max: number; interval: number }[] }).yAxis
    expect([y.min, y.max, y.interval]).toEqual([-20, 120, 20])
  })
  it('never-negative variables stop at 0: soil moisture is not drawn to −10 %', () => {
    const rows = Array.from({ length: 24 }, (_, i) => ({ station: 'x', datetime: `2026-07-01 ${String(i).padStart(2, '0')}:00:00-06:00`, 'Soil VWC @ 2 in [%]': 0.5 + i, 'Soil VWC @ 20 in [%]': 33 })) as ObservationRow[]
    const m: VariableModel = { ts: buildTimeseriesModel({ rows, vars: ['Soil VWC'], period: 'hourly' })!, period: 'hourly', view }
    const [y] = (variableChart(m, testCtx('light')) as unknown as { yAxis: { min: number }[] }).yAxis
    expect(y.min).toBe(0)
  })
  it('the sr-only twin stops at 500 rows; the Table view gets them all', () => {
    expect(variableTable(model(600)).rows).toHaveLength(501)
    expect(variableTableAll(model(600)).rows).toHaveLength(600)
  })
})

describe('latestTimeseriesChart on a compact touch screen', () => {
  it('pins the tooltip under the tapped panel', () => {
    const o = latestTimeseriesChart(model(24, ['Air Temperature', 'Relative Humidity']), testCtx('dark', 390, true, true))
    const pos = (o.tooltip as { position: (p: number[], ...r: unknown[]) => number[] }).position
    const size = { viewSize: [390, 600] }
    const first = pos([10, LAYOUT.top + 10], null, null, null, size)[1]
    const second = pos([10, LAYOUT.top + LAYOUT.compactPanel + LAYOUT.gap + 10], null, null, null, size)[1]
    expect(first).toBe(LAYOUT.top + LAYOUT.compactPanel + 4)
    expect(second).toBe(first + LAYOUT.compactPanel + LAYOUT.gap)
  })
})

describe('dashboardStackChart', () => {
  const two = model(168, ['Air Temperature', 'Relative Humidity'], [view[0], view[0] + 7 * DAY])
  type Stack = { grid: { top: number; height: number }[]; dataZoom: { type: string }[]; yAxis: { min: number; max: number; interval: number }[] }
  it('rows from `fill`: equal, at fixed tops, so two stacks with the same rows align; compact, no slider; ≤ 3 y intervals', () => {
    const a = dashboardStackChart({ ...two, fill: { rows: 3 } }, { ...testCtx('dark', 800), height: 600 }) as unknown as Stack
    const b = dashboardStackChart({ ...model(168, ['Air Temperature'], two.view), fill: { rows: 3 } }, { ...testCtx('dark', 800), height: 600 }) as unknown as Stack
    expect(a.grid.map((g) => g.top)).toEqual(fillRows(3, 600, true).tops.slice(0, 2))
    expect(b.grid[0].top).toBe(a.grid[0].top)
    expect(new Set(a.grid.slice(0, -1).map((g) => g.height)).size).toBeLessThanOrEqual(1)
    // Fewer panels than rows: the last takes the empty rows, ending where row 3 ends.
    const r = fillRows(3, 600, true)
    expect(a.grid[1].top + a.grid[1].height).toBe(r.tops[2] + r.height)
    expect(b.grid[0].top + b.grid[0].height).toBe(r.tops[2] + r.height)
    expect(a.dataZoom.some((z) => z.type === 'slider')).toBe(false)
    for (const y of a.yAxis) expect((y.max - y.min) / y.interval).toBeLessThanOrEqual(3)
  })
})
