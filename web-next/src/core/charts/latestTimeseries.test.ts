import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { buildTimeseriesModel } from '../models/timeseries'
import type { StationNormals } from '../normals'
import { ETR, NORMALS, PRECIP, THEMES, depthColor, variableStyle } from '../palette'
import { TABLE_ROW_LIMIT, latestTimeseriesChart, latestTimeseriesHeight, latestTimeseriesTable, fmtValue, type LatestTimeseriesModel } from './latestTimeseries'
import { LTTB_THRESHOLD } from './series'
import { testCtx } from './testing'
import { paint } from './theme'

type S = { id?: string; type?: string; name?: string; xAxisIndex?: number; yAxisIndex?: number; color?: string; data?: unknown[]; sampling?: string; lineStyle?: { type?: string }; symbolRotate?: number }
type Opt = { grid: { top: number; height: number }[]; xAxis: { min: number; max: number; axisLabel: { show: boolean } }[]; yAxis: { name: string; min?: number; max?: number }[]; dataZoom: { xAxisIndex: number[]; startValue: number; endValue: number }[]; series: S[]; graphic: { style?: { text?: string }; children?: { style?: { text?: string } }[] }[]; useUTC: boolean; tooltip: { formatter: (p: unknown) => string } }

const hourRows = (n: number, cols: (i: number) => Record<string, number | null>, day = '2026-07-01'): ObservationRow[] =>
  Array.from({ length: n }, (_, i) => ({
    station: 'acebozem',
    datetime: `${day} ${String(i % 24).padStart(2, '0')}:00:00-06:00`,
    ...cols(i),
  })) as ObservationRow[]

const view: [number, number] = [Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 2)]

function model(rows: ObservationRow[], vars: string[], extra: Partial<Parameters<typeof buildTimeseriesModel>[0]> = {}, period: 'hourly' | 'daily' | 'raw' = 'hourly'): LatestTimeseriesModel {
  const ts = buildTimeseriesModel({ rows, vars, period, ...extra })!
  return { ts, period, view }
}

const build = (m: LatestTimeseriesModel, theme: (typeof THEMES)[number] = 'dark', compact = false) =>
  latestTimeseriesChart(m, testCtx(theme, 900, compact)) as unknown as Opt
const dataSeries = (o: Opt) => o.series.filter((s) => !String(s.id ?? '').startsWith('aux:'))
const texts = (o: Opt) => o.graphic.flatMap((g) => [g.style?.text, ...(g.children ?? []).map((c) => c.style?.text)]).filter(Boolean)

const soil = (i: number) => ({ 'Soil VWC @ 2 in [%]': 10 + i, 'Soil VWC @ 20 in [%]': 20 + i, 'Soil VWC @ 4 in [%]': 15 })
const met = (i: number) => ({ 'Air Temperature @ 2 m [°F]': 60 + i, 'Precipitation [in]': i === 2 ? 0.1 : 0, 'Reference ET (a=0.23) [in]': 0.01 })

describe('latestTimeseriesChart', () => {
  type G = { x: number; y: number; children?: { style?: { text?: string } }[] }
  const keys = (o: Opt) => (o.graphic as G[]).filter((g) => g.children).map((g) => ({ text: g.children![1].style?.text, x: g.x, y: g.y }))

  it('keys: one left-aligned row above each panel, from the plot edge; chart-wide keys join the first row', () => {
    const m = model(hourRows(6, soil), ['Soil VWC'])
    m.ts.panels[0].sensorSpans = [{ x0: view[0], x1: view[0] + 3_600_000, text: 'x' }]
    const o = build(m)
    const row = keys(o)
    expect(row.map((k) => k.text)).toEqual(['2 in', '4 in', '20 in', 'Sensor change'])
    expect(new Set(row.map((k) => k.y)).size).toBe(1)
    expect(row[0].x).toBe(72)
    expect(row.every((k, i) => i === 0 || k.x > row[i - 1].x)).toBe(true)
  })
  it('keys: chart-wide keys take a row of their own above when the first row is too long', () => {
    const m = model(hourRows(6, soil), ['Soil VWC'])
    m.ts.panels[0].sensorSpans = [{ x0: view[0], x1: view[0] + 3_600_000, text: 'x' }]
    const row = keys(latestTimeseriesChart(m, testCtx('dark', 200, true)) as unknown as Opt)
    expect(row.find((k) => k.text === 'Sensor change')!.y).toBeLessThan(row.find((k) => k.text === '2 in')!.y)
  })
  it('a daily band (the variable page) keys the mean and the band', () => {
    const m = model(hourRows(3, (i) => ({ 'Air Temperature @ 2 m [°F]': 60 + i })), ['Air Temperature'])
    const s = m.ts.panels[0].series[0]
    m.ts.panels[0].series[0] = { ...s, band: { lo: s.values.map((v) => (v ?? 0) - 5), hi: s.values.map((v) => (v ?? 0) + 5) } }
    expect(keys(build(m)).map((k) => k.text)).toEqual(['Daily mean', 'Daily low–high'])
    expect(keys(build(model(hourRows(3, (i) => ({ 'Air Temperature @ 2 m [°F]': 60 + i })), ['Air Temperature'])))).toEqual([])
  })
  it('wind direction: compass ticks, a line broken at the north wrap', () => {
    const o = latestTimeseriesChart(model(hourRows(4, (i) => ({ 'Wind Direction @ 10 m [deg]': [350, 10, 20, 30][i] })), ['Wind Direction']), testCtx()) as unknown as {
      yAxis: { axisLabel: { formatter: (v: number) => string } }[]
      series: S[]
    }
    expect([0, 90, 360].map(o.yAxis[0].axisLabel.formatter)).toEqual(['N', 'E', 'N'])
    const line = o.series.find((x) => x.type === 'line' && !String(x.id).startsWith('aux:'))!
    expect((line.data as [number, number | null][]).filter((p) => p[1] === null)).toHaveLength(1)
  })
  it('rain bars are at least 2 px wide', () => {
    const bar = build(model(hourRows(6, met), ['Precipitation'])).series.find((x) => x.type === 'bar') as { barMinWidth?: number }
    expect(bar.barMinWidth).toBe(2)
  })

  it('one grid per panel, stacked, sharing one zoom over every x axis', () => {
    const o = build(model(hourRows(6, met), ['Precipitation', 'Reference ET', 'Air Temperature']))
    expect(o.useUTC).toBe(true)
    expect(o.grid).toHaveLength(3)
    expect(o.grid[1].top).toBeGreaterThan(o.grid[0].top + o.grid[0].height)
    expect(o.xAxis.map((x) => x.axisLabel.show)).toEqual([false, false, true])
    for (const z of o.dataZoom) {
      expect(z.xAxisIndex).toEqual([0, 1, 2])
      expect([z.startValue, z.endValue]).toEqual(view)
    }
  })

  it('the axes span exactly the plotted window, so the zoom slider starts full (track = window = what is drawn)', () => {
    const o = build(model(hourRows(6, met), ['Precipitation', 'Air Temperature']))
    for (const x of o.xAxis) expect([x.min, x.max]).toEqual(view)
    for (const z of o.dataZoom) expect([z.startValue, z.endValue]).toEqual([o.xAxis[0].min, o.xAxis[0].max])
    expect(o.yAxis[0].name).toBe('Rain (in)')
    expect(o.yAxis[0].min).toBe(0)
  })

  it('bars for precipitation and ETr, a line for air temperature, colors from the palette per theme', () => {
    for (const theme of THEMES) {
      const s = dataSeries(build(model(hourRows(6, met), ['Precipitation', 'Reference ET', 'Air Temperature']), theme))
      expect(s.map((x) => [x.type, x.xAxisIndex, x.yAxisIndex])).toEqual([['bar', 0, 0], ['bar', 1, 1], ['line', 2, 2]])
      expect(s[0].color).toBe(PRECIP[theme].bar)
      expect(s[1].color).toBe(ETR[theme].bar)
      expect(s[2].color).toBe(variableStyle('Air Temperature', theme)!.color)
    }
  })

  it('soil depths shallow → deep, colored by depth, labelled in the key row', () => {
    for (const theme of THEMES) {
      const o = build(model(hourRows(6, soil), ['Soil VWC']), theme)
      const s = dataSeries(o)
      expect(s.map((x) => x.name)).toEqual(['Soil VWC @ 2 in [%]', 'Soil VWC @ 4 in [%]', 'Soil VWC @ 20 in [%]'])
      expect(s.map((x) => x.color)).toEqual([2, 4, 20].map((d) => depthColor(d, theme)))
      expect(texts(o)).toEqual(expect.arrayContaining(['2 in', '4 in', '20 in']))
    }
  })

  it('multi-column line panels get a dash per column and a key', () => {
    const rows = hourRows(4, (i) => ({ 'Air Temperature @ 2 m [°F]': 60 + i, 'Air Temperature @ 8 ft [°F]': 61 + i }))
    const o = build(model(rows, ['Air Temperature']))
    expect(dataSeries(o).map((s) => s.lineStyle?.type)).toEqual(['solid', 'dashed'])
    expect(texts(o)).toEqual(expect.arrayContaining(['2 m', '8 ft']))
  })

  it('a variable with no data keeps its panel with the legacy note', () => {
    const o = build(model(hourRows(4, met), ['Air Temperature', 'Solar Radiation']))
    expect(o.grid).toHaveLength(2)
    expect(texts(o)).toContain('Solar Radiation data are not available for this time period.')
    expect(o.yAxis[1]).toMatchObject({ min: 0, max: 1 })
  })

  it('breaks lines at gaps and samples long raw lines with LTTB', () => {
    const rows = hourRows(5, (i) => ({ 'Air Temperature @ 2 m [°F]': i === 2 ? null : 60 }))
    const line = dataSeries(build(model(rows, ['Air Temperature'])))[0]
    expect((line.data as [number, number | null][]).some((p) => p[1] === null)).toBe(true)
    const many = Array.from({ length: LTTB_THRESHOLD + 10 }, (_, i) => ({
      station: 'x',
      datetime: `2026-07-${String(1 + Math.floor(i / 288)).padStart(2, '0')} ${String(Math.floor((i % 288) / 12)).padStart(2, '0')}:${String((i % 12) * 5).padStart(2, '0')}:00-06:00`,
      'Air Temperature @ 2 m [°F]': i % 7,
    })) as ObservationRow[]
    expect(dataSeries(build(model(many, ['Air Temperature'], {}, 'raw')))[0].sampling).toBe('lttb')
  })

  it('gridMET normals: a band for line variables, percentile markers for bars', () => {
    const norms: StationNormals = { byDay: new Map([['7-1', { mn: 40, mx: 80, avg: 60 }]]) }
    const o = build(model(hourRows(4, met), ['Air Temperature', 'Precipitation'], { normalsByVar: { 'Air Temperature': norms, Precipitation: norms } }), 'light')
    const band = o.series.find((s) => s.id === 'normals0-band')!
    expect(band).toMatchObject({ xAxisIndex: 0, yAxisIndex: 0 })
    expect(o.series.filter((s) => String(s.id).startsWith('aux:p0-normal-'))).toHaveLength(2)
    const marks = o.series.filter((s) => s.type === 'scatter')
    expect(marks.map((s) => [s.name, s.symbolRotate, s.xAxisIndex])).toEqual([['75th Percentile', 180, 1], ['Median', 0, 1], ['25th Percentile', 0, 1]])
    expect(marks[0].color).toBe(paint(testCtx('light').theme, NORMALS.line))
    expect(texts(o)).toContain('gridMET normal (1991–2020)')
  })

  it('sensor-change spans become a hatched custom series on their panel, with a key and tooltip text', () => {
    const m = model(hourRows(4, met), ['Air Temperature'])
    m.ts.panels[0].sensorSpans = [{ x0: view[0], x1: view[0] + 3_600_000, text: 'A sensor was added/replaced on 2026-07-01, affecting the following elements:<br>Air Temperature' }]
    const o = build(m)
    expect(o.series.find((s) => s.id === 'aux:sensor-events-0')).toMatchObject({ type: 'custom', xAxisIndex: 0, yAxisIndex: 0 })
    expect(texts(o)).toContain('Sensor change')
    const html = o.tooltip.formatter([{ seriesId: 'p0:Air Temperature @ 2 m [°F]', value: [view[0] + 1_800_000, 61], axisValue: view[0] + 1_800_000, marker: '' }])
    expect(html).toContain('Air Temperature')
    expect(html).toContain('affecting the following elements:<br>Air Temperature')
  })

  it('tooltip rows use the plain name and unit, never the API column', () => {
    const o = build(model(hourRows(3, (i) => ({ 'Wind Speed [mi/hr]': 5 + i })), ['Wind Speed']))
    const html = o.tooltip.formatter([{ seriesId: 'p0:Wind Speed [mi/hr]', value: [view[0], 6], axisValue: view[0], marker: '' }])
    expect(html).toContain('Wind')
    expect(html).toContain('6 mph')
    expect(html).not.toContain('mi/hr')
  })

  it('daily rows sit at local noon', () => {
    const rows = [1, 2, 3].map((d) => ({ station: 'x', datetime: `2026-07-0${d}`, 'Air Temperature @ 2 m [°F]': 60 })) as ObservationRow[]
    const line = dataSeries(build(model(rows, ['Air Temperature'], {}, 'daily')))[0]
    expect((line.data as [number, number][])[0][0]).toBe(Date.UTC(2026, 6, 1, 12))
  })

  it('heights follow the panel count', () => {
    expect(latestTimeseriesHeight(3, false)).toBeGreaterThan(latestTimeseriesHeight(2, false))
    expect(latestTimeseriesHeight(3, true)).toBeLessThan(latestTimeseriesHeight(3, false))
  })
})

describe('latestTimeseriesChart: the house chart style (style.ts)', () => {
  /** `days` × 24 hourly rows from Jul 1, minus the hours in `skip` (missing from the API). */
  const week = (cols: (i: number) => Record<string, number | null>, days = 7, skip: number[] = []) =>
    Array.from({ length: days * 24 }, (_, i) => i)
      .filter((i) => !skip.includes(i))
      .map((i) => ({ station: 'x', datetime: `2026-07-0${1 + Math.floor(i / 24)} ${String(i % 24).padStart(2, '0')}:00:00-06:00`, ...cols(i) })) as ObservationRow[]
  const weekView: [number, number] = [Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 8)]
  const at = (rows: ObservationRow[], vars: string[], period: 'hourly' | 'daily' | 'raw' = 'hourly', extra = {}) =>
    ({ ...model(rows, vars, extra, period), view: weekView })
  const nulls = (s: S) => (s.data as [number, number | null][]).filter((p) => p[1] === null).map((p) => p[0])

  it('gaps are breaks from the known interval: a missing hour gets a null; lines never connect across it', () => {
    const o = build(at(week((i) => ({ 'Air Temperature @ 2 m [°F]': 60 + (i % 5) }), 7, [30, 31]), ['Air Temperature']))
    const [line] = dataSeries(o)
    expect(nulls(line)).toEqual([Date.UTC(2026, 6, 2, 6, 30)]) // midway across 05:00 → 08:00
    expect(line).toMatchObject({ connectNulls: false, showSymbol: false, smooth: false, lineStyle: { width: 1.5 } })
  })

  it('5-min data breaks at the station cadence: a 15-min station is not broken every point', () => {
    const rows = Array.from({ length: 12 }, (_, i) => i)
      .filter((i) => i !== 6)
      .map((i) => ({ station: 'x', datetime: `2026-07-01 0${Math.floor(i / 4)}:${String((i % 4) * 15).padStart(2, '0')}:00-06:00`, 'Air Temperature @ 2 m [°F]': 60 })) as ObservationRow[]
    const [line] = dataSeries(build(model(rows, ['Air Temperature'], {}, 'raw')))
    expect(nulls(line)).toHaveLength(1)
  })

  it('y-axis rule per family: zero-based rain and wind, closed 0–100 humidity, free temperature', () => {
    const o = build(at(week((i) => ({ 'Precipitation [in]': i === 5 ? 0.42 : 0, 'Wind Speed [mi/hr]': 3 + (i % 20), 'Relative Humidity [%]': 40, 'Air Temperature @ 2 m [°F]': 35 + (i % 47) })), ['Precipitation', 'Wind Speed', 'Relative Humidity', 'Air Temperature']))
    const y = o.yAxis as unknown as { min?: number; max?: number; interval?: number; scale?: boolean; show?: boolean }[]
    expect(y[0]).toMatchObject({ min: 0, max: 0.5, scale: false })
    expect(y[1]).toMatchObject({ min: 0, max: 25, scale: false })
    expect(y[2]).toMatchObject({ min: 0, max: 100, interval: 25 })
    expect(y[3]).toMatchObject({ min: 30, max: 90, scale: true })
  })

  it('the slider (wide, > 2 days, ≥ 30 points) spans the window and traces the first panel: rain as its running total', () => {
    const o = build(at(week((i) => ({ 'Precipitation [in]': i % 10 ? 0 : 0.1, 'Air Temperature @ 2 m [°F]': 60 })), ['Precipitation', 'Air Temperature']))
    const zoom = o.dataZoom as unknown as { type: string; startValue: number; endValue: number; xAxisIndex: number[] }[]
    expect(zoom.map((z) => z.type)).toEqual(['inside', 'slider'])
    for (const z of zoom) expect([z.startValue, z.endValue, z.xAxisIndex]).toEqual([...weekView, [0, 1]])
    const trace = o.series[0]
    expect(trace).toMatchObject({ id: 'aux:zoom-trace', type: 'line', xAxisIndex: 0, yAxisIndex: 2 })
    const ys = (trace.data as [number, number | null][]).map((p) => p[1])
    expect([trace.data![0], trace.data!.at(-1)]).toEqual([[weekView[0], null], [weekView[1], null]])
    // Never flat: it climbs with every wet hour.
    expect(ys.filter((v) => v != null).at(-1)).toBeCloseTo(0.1 * 17, 9)
    expect((o.yAxis as unknown as { show?: boolean }[])[2].show).toBe(false)
  })

  it('soil traces its shallowest depth; no slider at 24 h, on phones, or for a short daily series', () => {
    const soilWeek = build(at(week((i) => ({ 'Soil VWC @ 20 in [%]': 30, 'Soil VWC @ 2 in [%]': 10 + (i % 3) })), ['Soil VWC']))
    expect(soilWeek.series[0].data!.slice(1, 3)).toEqual([[Date.UTC(2026, 6, 1, 0), 10], [Date.UTC(2026, 6, 1, 1), 11]])
    const day = model(hourRows(24, met), ['Air Temperature'])
    expect((build(day).dataZoom as unknown as { type: string }[]).map((z) => z.type)).toEqual(['inside'])
    expect((build(at(week(met), ['Air Temperature']), 'dark', true).dataZoom as unknown as { type: string }[]).map((z) => z.type)).toEqual(['inside'])
    const daily = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ station: 'x', datetime: `2026-07-0${d}`, 'Air Temperature @ 2 m [°F]': 60 })) as ObservationRow[]
    expect((build(at(daily, ['Air Temperature'], 'daily')).dataZoom as unknown as { type: string }[]).map((z) => z.type)).toEqual(['inside'])
  })

  it('builders never set animation (the chart host animates the first draw only)', () => {
    expect('animation' in build(at(week(met), ['Air Temperature']))).toBe(false)
  })
})

describe('latestTimeseriesTable', () => {
  it('a row per time step with data and a column per plotted column', () => {
    const t = latestTimeseriesTable(model(hourRows(3, met), ['Precipitation', 'Air Temperature']))
    expect(t.columns).toEqual(['Time (MT)', 'Rain (in)', 'Air temperature (°F)'])
    expect(t.rows[0]).toEqual(['2026-07-01 00:00', '0.00', '60.0']) // LABELS digits.table: one precision per variable
    expect(t.rows).toHaveLength(3)
  })
  it(`caps the twin at ${TABLE_ROW_LIMIT} rows with a closing note`, () => {
    const rows = Array.from({ length: 30 * 24 }, (_, i) => ({
      station: 'x',
      datetime: `2026-07-${String(1 + Math.floor(i / 24)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:00:00-06:00`,
      'Air Temperature @ 2 m [°F]': 60,
    })) as ObservationRow[]
    const t = latestTimeseriesTable(model(rows, ['Air Temperature']))
    expect(t.rows).toHaveLength(TABLE_ROW_LIMIT + 1)
    expect(t.rows.at(-1)).toEqual([`Showing first ${TABLE_ROW_LIMIT} of 720 rows; use the Data Downloader for the full record.`])
    expect(latestTimeseriesTable(model(hourRows(3, met), ['Air Temperature'])).rows).toHaveLength(3)
  })
  it('formats small values with 3 decimals', () => {
    expect([fmtValue(0.012), fmtValue(12.345), fmtValue(0)]).toEqual(['0.012', '12.35', '0'])
  })
})
