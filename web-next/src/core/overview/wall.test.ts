import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { buildTimeseriesModel } from '../models/timeseries'
import type { Variable } from '../variables'
import { WALL_MIN_HEIGHT, WALL_MIN_WIDTH, WALL_SIZE, showsWall, wallPanel, wallVariables, wallWindow } from './wall'

const v = (id: string, name = id): Variable => ({ id, name, group: 'Weather', sum: false, normals: false })

describe('showsWall', () => {
  it('needs the width beside the drawer and a screen tall enough', () => {
    expect(showsWall(WALL_MIN_WIDTH, WALL_MIN_HEIGHT)).toBe(true)
    expect(showsWall(WALL_MIN_WIDTH - 1, 1440)).toBe(false)
    expect(showsWall(2560, WALL_MIN_HEIGHT - 1)).toBe(false)
  })
})

describe('wallVariables', () => {
  it('preference order, only what the station reports, at most WALL_SIZE', () => {
    const list = ['bp', 'rh', 'air_temp', 'soil_temp', 'wind_spd', 'sol_rad', 'ppt', 'soil_vwc', 'snow_depth'].map((id) => v(id))
    expect(wallVariables(list).map((x) => x.id)).toEqual(['air_temp', 'ppt', 'wind_spd', 'rh', 'soil_vwc', 'soil_temp'])
    expect(wallVariables(list)).toHaveLength(WALL_SIZE)
  })
  it('a station without soil sensors fills in from further down the list', () => {
    const list = ['air_temp', 'ppt', 'wind_spd', 'rh', 'sol_rad', 'bp'].map((id) => v(id))
    expect(wallVariables(list).map((x) => x.id)).toEqual(['air_temp', 'ppt', 'wind_spd', 'rh', 'sol_rad', 'bp'])
    expect(wallVariables([v('snow_depth')])).toEqual([])
  })
})

describe('wallWindow', () => {
  it("the 7 d chip's window, ending today, at its Auto interval (hourly)", () => {
    expect(wallWindow(dayjs('2026-10-08'))).toEqual({ start: '2026-10-01', end: '2026-10-08', valid: true, agg: 'hourly' })
  })
})

describe('wallPanel', () => {
  const rows = [{ station: 'x', datetime: '2026-10-01 00:00:00-06:00', 'Air Temperature @ 2 m [°F]': 50, 'Relative Humidity [%]': 40 }]
  const ts = buildTimeseriesModel({ rows, vars: ['Air Temperature', 'Relative Humidity'], period: 'hourly' })!
  const m = { ts, period: 'hourly' as const, view: [0, 1] as [number, number] }
  it("one variable's panel of the shared model, the rest of the model kept", () => {
    const one = wallPanel(m, 'Relative Humidity')!
    expect(one.ts.panels.map((p) => p.variable)).toEqual(['Relative Humidity'])
    expect(one.ts.x).toBe(ts.x)
    expect(one.view).toBe(m.view)
  })
  it('null without the model or the panel', () => {
    expect(wallPanel(null, 'Air Temperature')).toBeNull()
    expect(wallPanel(m, 'Soil VWC')).toBeNull()
  })
})
