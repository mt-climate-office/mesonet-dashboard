import { describe, expect, it } from 'vitest'
import { chartHeading, chartPatch, chartsMode, showsNormals, findVariable, matchesQuery, neighbors, stationVariables, variableGroups, variableId, variableIdForElement, LIST_AG_TOOLS } from './catalog'

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
    expect(findVariable(vars, 'ppt')).toMatchObject({ sum: true, normals: true, group: 'Rain and evaporation' })
    expect(findVariable(vars, 'air_temp')).toMatchObject({ sum: false, normals: true })
    expect(findVariable(vars, 'bp')).toMatchObject({ sum: false, normals: false })
  })
  it('groups, skipping empty groups (no Well here)', () => {
    expect(variableGroups(vars).map((g) => g.group)).toEqual(['Weather', 'Rain and evaporation', 'Soil', 'Other'])
  })
  it('gives prev/next in list order', () => {
    expect(neighbors(vars, 'air_temp')).toEqual({ prev: null, next: vars[1] })
    expect(neighbors(vars, 'etr').next?.id).toBe('soil_temp')
    expect(neighbors(vars, 'nope')).toEqual({ prev: null, next: null })
  })
})

describe('chartsMode', () => {
  it('Compare wins, then an Ag tool, then a variable, else the list', () => {
    expect(chartsMode({ cmp: true, v: 'air_temp' })).toBe('compare')
    expect(chartsMode({ cmp: false, v: 'gdd' })).toBe('ag')
    expect(chartsMode({ cmp: false, v: 'soil_temp,soil_ec_blk' })).toBe('ag')
    expect(chartsMode({ cmp: false, v: 'air_temp' })).toBe('variable')
    expect(chartsMode({ cmp: false, v: null })).toBe('list')
  })
  it('etr is one id in one namespace: the Ag tool', () => {
    expect(chartsMode({ cmp: false, v: 'etr' })).toBe('ag')
  })
})

describe('LIST_AG_TOOLS', () => {
  it('lists every Ag tool but Annual comparison and Reference ET (listed under Rain and evaporation), in tool order', () => {
    expect(LIST_AG_TOOLS).toEqual(['gdd', 'feels_like', 'cci', 'soil_temp,soil_ec_blk', 'swp', 'percent_saturation'])
  })
})

describe('chartHeading', () => {
  it('focuses the Ag heading for an Ag tool (Reference ET included), else the variable heading', () => {
    expect(chartHeading('etr')).toBe('ag-chart-title')
    expect(chartHeading('gdd')).toBe('ag-chart-title')
    expect(chartHeading('air_temp')).toBe('var-title')
  })
})

describe('chartPatch', () => {
  it('opens a variable on its chart, an Ag tool through its reset patch', () => {
    expect(chartPatch('air_temp')).toEqual({ v: 'air_temp', view: 'recent', tbl: false, cmp: false })
    expect(chartPatch('etr')).toMatchObject({ v: 'etr', view: 'recent', tbl: false, crop: 'wheat', ag_time: 'daily' })
  })
})

describe('showsNormals', () => {
  it('daily air temperature only', () => {
    expect(showsNormals({ name: 'Air Temperature' }, 'daily')).toBe(true)
    expect(showsNormals({ name: 'Air Temperature' }, 'hourly')).toBe(false)
    expect(showsNormals({ name: 'Precipitation' }, 'daily')).toBe(false)
  })
})

describe('matchesQuery', () => {
  it('every word, any case, in any of the texts; empty matches all', () => {
    expect(matchesQuery('', 'Air temperature')).toBe(true)
    expect(matchesQuery('soil moist', 'Soil moisture', 'at 2 in')).toBe(true)
    expect(matchesQuery('TEMP', 'Air temperature')).toBe(true)
    expect(matchesQuery('rain', 'Air temperature', 'Weather')).toBe(false)
  })
})

describe('variableIdForElement', () => {
  it('maps an element code to its variable id, the longest prefix winning', () => {
    expect(variableIdForElement('air_temp_0200')).toBe('air_temp')
    expect(variableIdForElement('soil_vwc_0400')).toBe('soil_vwc')
    expect(variableIdForElement('ppt')).toBe('ppt')
    expect(variableIdForElement('ppt_max_rate')).toBe('ppt_max_rate')
    expect(variableIdForElement('wind_dir_1000')).toBe('wind_dir')
    expect(variableIdForElement('soil_ec_blk_0020')).toBe('soil_ec_blk')
  })
  it('an unmapped element is its own id', () => {
    expect(variableIdForElement('lfwt_0100')).toBe('lfwt_0100')
  })
})
