import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import type { StationNormals } from '../normals'
import {
  NO_DATA_TITLE,
  availableVars,
  buildTimeseriesModel,
  chartWindow,
  emptyState,
  requestElements,
} from './timeseries'

const hourly = (n: number, cols: (i: number) => Record<string, number | null>): ObservationRow[] =>
  Array.from({ length: n }, (_, i) => ({
    station: 'acebozem',
    datetime: `2026-07-01 ${String(i).padStart(2, '0')}:00:00-06:00`,
    ...cols(i),
  })) as ObservationRow[]

describe('request planning', () => {
  it('filters the selection to the station, keeping selection order', () => {
    const els = [
      { element: 'air_temp_0200', description_short: 'Air Temperature @ 2 m' },
      { element: 'ppt', description_short: 'Precipitation' },
    ]
    expect(availableVars(['Soil VWC', 'Air Temperature', 'Reference ET', 'Precipitation'], els)).toEqual([
      'Air Temperature',
      'Reference ET',
      'Precipitation',
    ])
    expect(availableVars(['Soil VWC'])).toEqual(['Soil VWC'])
    expect(requestElements(['Air Temperature', 'Reference ET'], els)).toEqual({ elements: 'air_temp', hasEtr: true })
  })

  it('defaults the window to the last 14 days and rejects malformed or reversed dates', () => {
    const today = dayjs('2026-07-15')
    expect(chartWindow(null, null, today)).toEqual({ start: '2026-07-01', end: '2026-07-15', valid: true })
    expect(chartWindow('2026-07-10', '2026-07-01', today).valid).toBe(false)
    expect(chartWindow('2026-13-40', null, today).valid).toBe(false)
  })
})

describe('emptyState', () => {
  const base = { selection: ['Air Temperature'], available: ['Air Temperature'], param: 'x', station: 'x', catalogLoaded: true, windowValid: true }
  it('follows the legacy order', () => {
    expect(emptyState(base)).toBeNull()
    expect(emptyState({ ...base, selection: [] })?.kind).toBe('no-vars')
    expect(emptyState({ ...base, available: [] })?.kind).toBe('no-vars')
    expect(emptyState({ ...base, param: null, station: null })?.kind).toBe('no-station')
    expect(emptyState({ ...base, station: null })?.kind).toBe('not-found')
    expect(emptyState({ ...base, station: null, catalogLoaded: false })).toBeNull()
    expect(emptyState({ ...base, windowValid: false })?.title).toBe(NO_DATA_TITLE)
  })
})

describe('buildTimeseriesModel', () => {
  it('one panel per variable in order; an empty variable keeps a noData panel', () => {
    const rows = hourly(4, (i) => ({ 'Air Temperature [°F]': 60 + i, 'Precipitation [in]': i === 1 ? 0.1 : 0 }))
    const m = buildTimeseriesModel({ rows, vars: ['Precipitation', 'Air Temperature', 'Solar Radiation'], period: 'hourly' })!
    expect(m.panels.map((p) => p.variable)).toEqual(['Precipitation', 'Air Temperature', 'Solar Radiation'])
    expect(m.panels[0].series[0]).toMatchObject({ type: 'bar', hoverLabel: 'Precipitation Total' })
    expect(m.panels[1].series[0]).toMatchObject({ type: 'line', values: [60, 61, 62, 63] })
    expect(m.panels[2]).toMatchObject({ noData: true, series: [] })
    expect(m.panels[0].axisTitle).toBe('Precipitation<br>(inches/hour)')
  })

  it('x is wall-clock ms, gaps get null rows, and the x range pads a day each side', () => {
    const rows = hourly(6, (i) => ({ 'Air Temperature [°F]': i })).filter((_, i) => i !== 3)
    const m = buildTimeseriesModel({ rows, vars: ['Air Temperature'], period: 'hourly' })!
    expect(m.x[0]).toBe(Date.parse('2026-07-01T00:00:00Z'))
    expect(m.panels[0].series[0].values).toEqual([0, 1, 2, null, 4, 5])
    expect(m.xRange).toEqual([Date.parse('2026-06-30T00:00:00Z'), Date.parse('2026-07-02T00:00:00Z')])
  })

  it('soil columns sort shallow → deep and carry their depth', () => {
    const rows = hourly(3, () => ({ 'Soil VWC @ 20 in [%]': 30, 'Soil VWC @ 2 in [%]': 20, 'Soil VWC @ 8 in [%]': 25 }))
    const p = buildTimeseriesModel({ rows, vars: ['Soil VWC'], period: 'hourly' })!.panels[0]
    expect(p.isSoil).toBe(true)
    expect(p.series.map((s) => s.depth)).toEqual(['2 in', '8 in', '20 in'])
    expect(p.legend).toBe(false)
  })

  it('normals: band for lines, markers for bars; snow depth floors its range at 0..1', () => {
    const rows = [
      { station: 'x', datetime: '2026-07-01 00:00:00-06:00', 'Air Temperature [°F]': 70, 'Precipitation [in]': 0.2, 'Snow Depth [in]': 0 },
      { station: 'x', datetime: '2026-07-02 00:00:00-06:00', 'Air Temperature [°F]': 72, 'Precipitation [in]': 0, 'Snow Depth [in]': 0 },
    ] as ObservationRow[]
    const n: StationNormals = { byDay: new Map([['7-1', { mn: 50, mx: 80, avg: 65 }]]) }
    const m = buildTimeseriesModel({
      rows,
      vars: ['Air Temperature', 'Precipitation', 'Snow Depth'],
      period: 'daily',
      normalsByVar: { 'Air Temperature': n, Precipitation: n },
    })!
    expect(m.panels[0].normals).toEqual({ kind: 'band', min: [50, null], max: [80, null], label: 'Air Temperature [°F]' })
    expect(m.panels[1].normals).toMatchObject({ kind: 'markers', median: [65, null] })
    expect(m.panels[2].yRange).toEqual([0, 1])
  })

  it('sensor spans come from the station config, except on Reference ET', () => {
    const rows = hourly(24, (i) => ({ 'Air Temperature [°F]': i, 'Reference ET [in]': 0.01 }))
    const config = [{ element: 'Air Temperature [°F]', dateStart: '2026-07-01', dateEnd: null, outageRanges: [] }]
    const m = buildTimeseriesModel({ rows, vars: ['Air Temperature', 'Reference ET'], period: 'hourly', sensorConfig: config, now: Date.parse('2026-07-02T00:00:00Z') })!
    expect(m.panels[0].sensorSpans.length).toBeGreaterThan(0)
    expect(m.panels[0].sensorSpans[0].text).toMatch(/^A sensor was added\/replaced on 2026-07-01/)
    expect(m.panels[1].sensorSpans).toEqual([])
  })

  it('returns null without rows or variables', () => {
    expect(buildTimeseriesModel({ rows: [], vars: ['Air Temperature'], period: 'hourly' })).toBeNull()
  })
})
