import { describe, expect, it } from 'vitest'
import { buildTimeseriesModel } from './models/timeseries'
import { DASHBOARD_MIN_HEIGHT, DASHBOARD_MIN_WIDTH, DASHBOARD_RANGES, pageFor, showsDashboard, stackColumns, stackOf } from './dashboard'
import type { Variable } from './variables'

describe('showsDashboard', () => {
  it('needs the width beside the drawer and the height', () => {
    expect(showsDashboard(DASHBOARD_MIN_WIDTH, DASHBOARD_MIN_HEIGHT)).toBe(true)
    expect(showsDashboard(DASHBOARD_MIN_WIDTH - 1, 1440)).toBe(false)
    expect(showsDashboard(2560, DASHBOARD_MIN_HEIGHT - 1)).toBe(false)
  })
})

describe('pageFor', () => {
  const none = { cmp: false, v: null }
  it('without room: the section itself', () => {
    for (const s of ['now', 'charts', 'about'] as const) expect(pageFor(s, none, false)).toBe(s)
    expect(pageFor('charts', { cmp: false, v: 'air_temp' }, false)).toBe('charts')
  })
  it('with room: Now, About and the Charts list are the dashboard; a chart keeps its page', () => {
    expect(pageFor('now', none, true)).toBe('dashboard')
    expect(pageFor('about', none, true)).toBe('dashboard')
    expect(pageFor('charts', none, true)).toBe('dashboard')
    expect(pageFor('charts', { cmp: false, v: 'air_temp' }, true)).toBe('charts')
    expect(pageFor('charts', { cmp: false, v: 'gdd' }, true)).toBe('charts')
    expect(pageFor('charts', { cmp: true, v: null }, true)).toBe('charts')
    // A Now URL that still carries v (left by a chart page) is the dashboard.
    expect(pageFor('now', { cmp: false, v: 'air_temp' }, true)).toBe('dashboard')
  })
})

describe('DASHBOARD_RANGES', () => {
  it('the presets up to 30 days', () => {
    expect(DASHBOARD_RANGES.map((r) => r.id)).toEqual(['24h', '7d', '14d', '30d'])
  })
})

describe('stackColumns', () => {
  const v = (id: string, group: Variable['group']): Variable => ({ id, name: id, group, sum: false, normals: false })
  const weather = ['air_temp', 'rh', 'wind_spd', 'windgust', 'wind_dir', 'sol_rad', 'bp', 'snow_depth'].map((id) => v(id, 'Weather'))
  const rain = ['ppt', 'ppt_max_rate', 'etr'].map((id) => v(id, 'Rain and evaporation'))
  const soil = ['soil_temp', 'soil_vwc', 'soil_ec_blk'].map((id) => v(id, 'Soil'))
  it('Weather | Rain and soil, split at the group boundary; wind direction is left out (the rose)', () => {
    const [a, b] = stackColumns([...weather, ...rain, ...soil])
    expect(a.map((x) => x.id)).toEqual(['air_temp', 'rh', 'wind_spd', 'windgust', 'sol_rad', 'bp', 'snow_depth'])
    expect(b.map((x) => x.id)).toEqual(['ppt', 'ppt_max_rate', 'etr', 'soil_temp', 'soil_vwc', 'soil_ec_blk'])
  })
  it('one big group: split at the middle', () => {
    const [a, b] = stackColumns(weather)
    expect(a.length - b.length).toBeLessThanOrEqual(1)
    expect([...a, ...b].map((x) => x.id)).toEqual(weather.filter((x) => x.id !== 'wind_dir').map((x) => x.id))
  })
  it('fewer than two: one stack', () => {
    expect(stackColumns([v('air_temp', 'Weather')])).toEqual([[v('air_temp', 'Weather')], []])
    expect(stackColumns([])).toEqual([[], []])
  })
})

describe('stackOf', () => {
  const rows = [{ station: 'x', datetime: '2026-10-01 00:00:00-06:00', 'Air Temperature @ 2 m [°F]': 50, 'Relative Humidity [%]': 40, 'Atmospheric Pressure [mb]': 850 }]
  const ts = buildTimeseriesModel({ rows, vars: ['Air Temperature', 'Relative Humidity', 'Atmospheric Pressure'], period: 'hourly' })!
  const m = { ts, period: 'hourly' as const, view: [0, 1] as [number, number] }
  it("the named panels of the shared model, in the order named; the rest of the model kept", () => {
    const one = stackOf(m, ['Atmospheric Pressure', 'Air Temperature'])!
    expect(one.ts.panels.map((p) => p.variable)).toEqual(['Atmospheric Pressure', 'Air Temperature'])
    expect(one.ts.x).toBe(ts.x)
    expect(one.view).toBe(m.view)
  })
  it('null without the model or any of its panels', () => {
    expect(stackOf(null, ['Air Temperature'])).toBeNull()
    expect(stackOf(m, ['Soil VWC'])).toBeNull()
  })
})
