import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import type { Station } from '../api'
import { NETWORK_OPTIONS } from '../url-schema'
import {
  datesPatch,
  installDate,
  netsValue,
  networkOptions,
  periodOfRecordPatch,
  showingPeriodOfRecord,
  stationItems,
  variableOptions,
  varsValue,
} from './sidebar'
import { visibleStationIds } from './stations'

const st = (station: string, name: string, sub_network: string, extra: Partial<Station> = {}): Station =>
  ({ station, name, sub_network, nwsli_id: null, county: 'Gallatin', date_installed: null, ...extra }) as Station

const list = [st('b', 'Bozeman', 'AgriMet', { nwsli_id: 'BZNM8' }), st('a', 'Alpha', 'HydroMet'), st('c', 'Corvallis', 'AgriMet')]
const today = dayjs('2026-10-01')

describe('networks', () => {
  it('lists catalog networks sorted, with a fallback before load', () => {
    expect(networkOptions(list)).toEqual(['AgriMet', 'HydroMet'])
    expect(networkOptions([])).toEqual(['AgriMet', 'HydroMet'])
  })
  it('filters, shows all when empty, and keeps the selected station', () => {
    expect(visibleStationIds(list, ['HydroMet'], null)).toEqual(['a'])
    expect(visibleStationIds(list, ['HydroMet'], 'b')).toEqual(['b', 'a'])
    expect(visibleStationIds(list, [], null)).toEqual(['b', 'a', 'c'])
  })
  it('stores every network on as the default', () => {
    expect(netsValue(['AgriMet', 'HydroMet'], ['AgriMet', 'HydroMet'])).toEqual([...NETWORK_OPTIONS])
    expect(netsValue(['AgriMet', 'Cooperator'], ['AgriMet', 'HydroMet'])).toEqual(['AgriMet'])
  })
})

describe('stationItems', () => {
  it('groups by network, sorts names, and matches NWSLI ids', () => {
    const items = stationItems(list, [...NETWORK_OPTIONS], null)
    expect(items.map((i) => [i.group, i.label])).toEqual([
      ['AgriMet', 'Bozeman'],
      ['AgriMet', 'Corvallis'],
      ['HydroMet', 'Alpha'],
    ])
    expect(items[0].keywords).toContain('BZNM8')
  })
})

describe('variables', () => {
  it('offers sorted defaults without a station, the station list with one', () => {
    expect(variableOptions(undefined)[0]).toBe('Air Temperature')
    expect(variableOptions([{ element: 'ppt_corrected', description_short: 'Precipitation (fill-corrected)' }, { element: 'rh', description_short: 'Relative Humidity' }])).toEqual([
      'Reference ET',
      'Relative Humidity',
    ])
  })
  it('keeps selection order, appends new chips, keeps vars the station lacks', () => {
    const options = ['Air Temperature', 'Precipitation', 'Reference ET', 'Soil VWC']
    expect(varsValue(['Precipitation', 'Well EC', 'Air Temperature'], ['Air Temperature', 'Reference ET'], options)).toEqual([
      'Well EC',
      'Air Temperature',
      'Reference ET',
    ])
    expect(varsValue(['Air Temperature'], [], options)).toEqual([])
  })
  it('stores the default five in default order as absent', () => {
    const d = ['Precipitation', 'Reference ET', 'Soil VWC', 'Soil Temperature', 'Air Temperature']
    expect(varsValue(d, d, d)).toBeNull()
  })
})

describe('dates and period of record', () => {
  it('reads install dates', () => {
    expect(installDate({ date_installed: '2016-08-11T00:00:00' })).toBe('2016-08-11')
    expect(installDate({ date_installed: 'n/a' })).toBeNull()
  })
  it('stores the default window as absent', () => {
    expect(datesPatch('2026-09-17', '2026-10-01', today)).toEqual({ from: null, to: null })
    expect(datesPatch('2026-09-01', '2026-10-01', today)).toEqual({ from: '2026-09-01', to: '2026-10-01' })
  })
  it('toggles daily POR and back to hourly 2 weeks (LDC-005)', () => {
    const on = periodOfRecordPatch(false, '2016-08-11', today)
    expect(on).toEqual({ agg: 'daily', from: '2016-08-11', to: '2026-10-01' })
    expect(showingPeriodOfRecord('daily', '2016-08-11', '2026-10-01', '2016-08-11', today)).toBe(true)
    expect(showingPeriodOfRecord('hourly', '2016-08-11', '2026-10-01', '2016-08-11', today)).toBe(false)
    expect(periodOfRecordPatch(true, '2016-08-11', today)).toEqual({ agg: 'hourly', from: null, to: null })
    expect(periodOfRecordPatch(false, null, today).from).toBe('2017-01-01')
  })
})
