import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { buildTimeseriesModel } from '../models/timeseries'
import { THEMES, variableStyle } from '../palette'
import { LAYOUT, latestTimeseriesChart } from './latestTimeseries'
import { testCtx } from './testing'
import { variableChart, variableTable, variableTableAll, type VariableModel } from './variable'

const DAY = 86_400_000
const view: [number, number] = [Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 2)]
const rows = (n: number): ObservationRow[] =>
  Array.from({ length: n }, (_, i) => ({
    station: 'acebozem',
    datetime: `2026-07-${String(1 + Math.floor(i / 24)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:00:00-06:00`,
    'Air Temperature @ 2 m [°F]': 60 + (i % 24),
    'Relative Humidity [%]': 50,
  })) as ObservationRow[]
const model = (n = 24, vars = ['Air Temperature']): VariableModel => ({
  ts: buildTimeseriesModel({ rows: rows(n), vars, period: 'hourly' })!,
  period: 'hourly',
  view,
  extent: [view[0] - DAY, view[1]],
})

type Opt = { grid: Record<string, number>[]; series: { type: string; color: string }[]; dataZoom: { type: string; disabled?: boolean }[]; tooltip: { triggerOn?: string } }

describe('variableChart', () => {
  it('draws the Compare panel for one variable, its plot filling the host height', () => {
    for (const theme of THEMES) {
      const o = variableChart(model(), testCtx(theme)) as unknown as Opt
      expect(o.grid).toHaveLength(1)
      expect(o.grid[0]).toMatchObject({ top: LAYOUT.top, bottom: LAYOUT.bottom })
      expect(o.grid[0].height).toBeUndefined()
      expect(o.series[0]).toMatchObject({ type: 'line', color: variableStyle('Air Temperature', theme)!.color })
    }
    expect((variableChart(model(), testCtx('dark', 390, true)) as unknown as Opt).grid[0].bottom).toBe(LAYOUT.compactBottom)
  })
  it('touch: swipes scroll (inside zoom disabled), taps show the tooltip', () => {
    const o = variableChart(model(), testCtx('dark', 390, true, true)) as unknown as Opt
    expect(o.dataZoom).toEqual([expect.objectContaining({ type: 'inside', disabled: true })])
    expect(o.tooltip.triggerOn).toBe('click')
  })
  it("the x axis is the shown window, so the slider's track matches the chart (no empty zoom-out padding)", () => {
    const o = variableChart(model(), testCtx('dark')) as unknown as Opt & { xAxis: { min: number; max: number }[] }
    expect(o.xAxis[0]).toMatchObject({ min: view[0], max: view[1] })
    const slider = o.dataZoom.find((z) => z.type === 'slider') as { startValue: number; endValue: number }
    expect([slider.startValue, slider.endValue]).toEqual([o.xAxis[0].min, o.xAxis[0].max])
  })
  it('compact tooltip: no panel sub-header for one variable', () => {
    const o = variableChart(model(), testCtx('dark')) as unknown as { tooltip: { formatter: (p: unknown) => string } }
    const html = o.tooltip.formatter([{ seriesIndex: 0, value: [view[0], 61], axisValue: view[0], marker: '' }])
    expect(html).toContain('61 °F')
    expect(html).not.toContain('tooltip-sub')
  })
  it('daily with a band: a low–high fill behind the line, named in the tooltip and tabled', () => {
    const m = model(24)
    const s = m.ts.panels[0].series[0]
    const banded: VariableModel = { ...m, period: 'daily', ts: { ...m.ts, panels: [{ ...m.ts.panels[0], series: [{ ...s, band: { lo: s.values.map((v) => v! - 5), hi: s.values.map((v) => v! + 5) } }] }] } }
    const o = variableChart(banded, testCtx('light')) as unknown as { series: { id: string; z?: number }[]; tooltip: { formatter: (p: unknown) => string } }
    expect(o.series.map((x) => x.id)).toEqual([expect.stringContaining('Air Temperature'), 'aux:daily-range-base', 'daily-range-band'])
    expect(o.series[2].z).toBe(1)
    const html = o.tooltip.formatter([
      { seriesIndex: 0, value: [view[0], 61], axisValue: view[0], marker: '' },
      { seriesIndex: 2, seriesId: 'daily-range-band', value: [view[0], 10, '55.0–65.0'], axisValue: view[0] },
    ])
    expect(html).toContain('Low–high')
    expect(html).toContain('55.0–65.0 °F')
    expect(variableTable(banded).columns).toEqual(['Date', 'Air temperature (°F)', 'Low: Air temperature (°F)', 'High: Air temperature (°F)'])
    expect((variableChart(model(), testCtx('light')) as unknown as { series: unknown[] }).series).toHaveLength(1)
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
