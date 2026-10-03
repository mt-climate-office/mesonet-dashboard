import { describe, expect, it } from 'vitest'
import { chartsMode, findVariable, neighbors, stationVariables, variableGroups, variableId } from './catalog'

// acebozem's /elements (2026-10-01), one row per element family plus a new, unmapped element.
const ELEMENTS = [
  ['soil_temp_0010', 'Soil Temperature @ -10 cm'],
  ['air_temp_0200', 'Air Temperature @ 2 m'],
  ['ppt_max_rate', 'Max Precip Rate'],
  ['soil_vwc_0050', 'Soil VWC @ -50 cm'],
  ['wind_spd_1000', 'Wind Speed @ 10 m'],
  ['wind_dir_1000', 'Wind Direction @ 10 m'],
  ['soil_ec_blk_0020', 'Bulk EC @ -20 cm'],
  ['sol_rad', 'Solar Radiation'],
  ['bp', 'Atmospheric Pressure'],
  ['rh', 'Relative Humidity'],
  ['ppt', 'Precipitation'],
  ['ppt_corrected', 'Precipitation (fill-corrected)'],
  ['snow_depth', 'Snow Depth'],
  ['windgust_1000', 'Gust Speed @ 10 m'],
  ['lw_in', 'Longwave In'],
].map(([element, description_short]) => ({ element, description_short }))

describe('stationVariables', () => {
  const vars = stationVariables(ELEMENTS)
  it('lists every display variable once, in group order, with ETr and without ppt_corrected', () => {
    expect(vars.map((v) => v.name)).toEqual([
      'Air Temperature',
      'Relative Humidity',
      'Wind Speed',
      'Gust Speed',
      'Wind Direction',
      'Solar Radiation',
      'Atmospheric Pressure',
      'Snow Depth',
      'Precipitation',
      'Max Precip Rate',
      'Reference ET',
      'Soil Temperature',
      'Soil VWC',
      'Bulk EC',
      'Longwave In',
    ])
  })
  it('uses element-family ids, the element code for unmapped ones', () => {
    expect(vars.map((v) => v.id)).toContain('air_temp')
    expect(findVariable(vars, 'etr')?.name).toBe('Reference ET')
    expect(findVariable(vars, 'lw_in')?.group).toBe('Other')
    expect(variableId('Soil VWC')).toBe('soil_vwc')
    expect(variableId('Brand New Thing')).toBe('brand_new_thing')
    expect(findVariable(vars, null)).toBeUndefined()
  })
  it('flags summed and normals variables', () => {
    expect(findVariable(vars, 'ppt')).toMatchObject({ sum: true, normals: true, group: 'Precipitation & ET' })
    expect(findVariable(vars, 'air_temp')).toMatchObject({ sum: false, normals: true })
    expect(findVariable(vars, 'bp')).toMatchObject({ sum: false, normals: false })
  })
  it('groups, skipping empty groups (no Well here)', () => {
    expect(variableGroups(vars).map((g) => g.group)).toEqual(['Weather', 'Precipitation & ET', 'Soil', 'Other'])
  })
  it('gives prev/next in list order', () => {
    expect(neighbors(vars, 'air_temp')).toEqual({ prev: null, next: vars[1] })
    expect(neighbors(vars, 'etr').next?.id).toBe('soil_temp')
    expect(neighbors(vars, 'nope')).toEqual({ prev: null, next: null })
  })
})

describe('chartsMode', () => {
  it('Compare wins, then a variable, else the list', () => {
    expect(chartsMode({ cmp: true, v: 'air_temp' })).toBe('compare')
    expect(chartsMode({ cmp: false, v: 'air_temp' })).toBe('variable')
    expect(chartsMode({ cmp: false, v: null })).toBe('list')
  })
})
