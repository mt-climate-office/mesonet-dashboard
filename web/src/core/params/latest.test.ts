import { describe, expect, it } from 'vitest'
import {
  COLOR_MAPPER,
  ELEM_MAP,
  latestElementCodes,
  latestVarsFromElements,
} from './latest'
import { latestVariableForColumn } from './columns'

// mdamalta-like element list (well station; /elements/{s}/ rows trimmed).
const ELEMENTS = [
  { element: 'soil_temp_0010', description_short: 'Soil Temperature @ -10 cm' },
  { element: 'ppt_max_rate', description_short: 'Max Precip Rate' },
  { element: 'vpd_atmo', description_short: 'VPD' },
  { element: 'wind_dir_0244', description_short: 'Wind Direction @ 8 ft' },
  { element: 'wind_spd_0244', description_short: 'Wind Speed @ 8 ft' },
  { element: 'windgust_0244', description_short: 'Gust Speed @ 8 ft' },
  { element: 'soil_ec_blk_0020', description_short: 'Bulk EC @ -20 cm' },
  { element: 'well_eco', description_short: 'Well EC' },
  { element: 'well_lvl', description_short: 'Well Water Level' },
  { element: 'well_tmp', description_short: 'Well Water Temperature' },
  { element: 'ppt', description_short: 'Precipitation' },
  { element: 'ppt_corrected', description_short: 'Precipitation (fill-corrected)' },
  { element: 'snow_depth', description_short: 'Snow Depth' },
  { element: 'new_thing', description_short: 'New Thing @ 2 m' },
]

describe('latestVarsFromElements', () => {
  it('splits on "@", dedups, adds Reference ET, sorts, and skips ppt_corrected', () => {
    expect(latestVarsFromElements(ELEMENTS)).toEqual([
      'Bulk EC',
      'Gust Speed',
      'Max Precip Rate',
      'New Thing',
      'Precipitation',
      'Reference ET',
      'Snow Depth',
      'Soil Temperature',
      'VPD',
      'Well EC',
      'Well Water Level',
      'Well Water Temperature',
      'Wind Direction',
      'Wind Speed',
    ])
  })
})

describe('latestElementCodes', () => {
  it('uses ELEM_MAP prefixes and drops Reference ET', () => {
    expect(latestElementCodes(['Precipitation', 'Reference ET', 'Well EC'], ELEMENTS)).toEqual([
      'ppt',
      'well_eco',
    ])
  })
  it('falls back to the station elements for unknown variables', () => {
    expect(latestElementCodes(['New Thing'], ELEMENTS)).toEqual(['new_thing'])
    expect(latestElementCodes(['New Thing'])).toEqual([])
  })
  it('keeps wind_dir with Wind Speed', () => {
    expect(latestElementCodes(['Wind Speed'], ELEMENTS)).toEqual(['wind_spd', 'wind_dir'])
  })
})

describe('COLOR_MAPPER', () => {
  it('covers every ELEM_MAP variable', () => {
    for (const v of Object.keys(ELEM_MAP)) if (v !== 'Reference ET') expect(v in COLOR_MAPPER, v).toBe(true)
  })
})

describe('latestVariableForColumn', () => {
  it.each([
    ['VPD [mbar]', 'VPD'],
    ['Well EC [mS/cm]', 'Well EC'],
    ['Well Water Level [in]', 'Well Water Level'],
    ['Well Water Temperature [°F]', 'Well Water Temperature'],
    ['Max Precip Rate [in/h]', 'Max Precip Rate'],
    ['Gust Speed [mi/hr]', 'Gust Speed'],
    ['Snow Depth [in]', 'Snow Depth'],
    ['Precipitation [in]', 'Precipitation'],
    ['New Thing @ 2 m [x]', 'New Thing'],
  ])('%s → %s', (col, v) => {
    expect(latestVariableForColumn(col)).toBe(v)
  })
  it('ignores ppt_corrected and meta columns', () => {
    expect(latestVariableForColumn('Precipitation (fill-corrected) [in]')).toBeNull()
    expect(latestVariableForColumn('provisional')).toBeNull()
    expect(latestVariableForColumn('datetime')).toBeNull()
  })
})
