import { describe, expect, it } from 'vitest'
import type { Station } from '../api'
import { formatCoordinates, formatDay, formatElevation, periodOfRecord, stationDetails } from './details'
import { measuresText, sensorHistory, sensorName } from './sensorHistory'

const bozeman: Station = {
  station: 'acebozem',
  name: 'Bozeman',
  date_installed: '2020-10-30',
  sub_network: 'HydroMet',
  longitude: -111.07,
  latitude: 45.66,
  elevation: 1495.09,
  county: 'Gallatin',
  mesowest_id: null,
  gwic_id: null,
  nwsli_id: 'BZNM8',
  has_swp: true,
  funded: true,
}

describe('details', () => {
  it('formats dates, coordinates and elevation', () => {
    expect(formatDay('2020-10-30')).toBe('Oct 30, 2020')
    expect(formatDay('2026-10-01 13:15:00-06:00')).toBe('Oct 1, 2026')
    expect(formatDay('None')).toBeNull()
    expect(formatCoordinates(45.66, -111.07)).toBe('45.66° N, 111.07° W')
    expect(formatElevation(1495.09)).toBe('4,905 ft (1,495 m)')
    expect(formatElevation(Number.NaN)).toBe('—')
  })

  it('period of record runs to the newest report, or "Since" until it arrives', () => {
    expect(periodOfRecord('2020-10-30', '2026-10-01 13:15:00-06:00')).toBe('Oct 30, 2020 – Oct 1, 2026')
    expect(periodOfRecord('2020-10-30', undefined)).toBe('Since Oct 30, 2020')
    expect(periodOfRecord(null, '2026-10-01')).toBe('—')
  })

  it('lists the rows in order, leaving out a missing NWS ID and county', () => {
    expect(stationDetails(bozeman, '2026-10-01 13:15:00-06:00')).toEqual([
      { label: 'Name', value: 'Bozeman' },
      { label: 'Station ID', value: 'acebozem' },
      { label: 'Network', value: 'HydroMet' },
      { label: 'NWS ID', value: 'BZNM8' },
      { label: 'County', value: 'Gallatin' },
      { label: 'Coordinates', value: '45.66° N, 111.07° W' },
      { label: 'Elevation', value: '4,905 ft (1,495 m)' },
      { label: 'Installed', value: 'Oct 30, 2020' },
      { label: 'Period of record', value: 'Oct 30, 2020 – Oct 1, 2026' },
    ])
    const labels = stationDetails({ ...bozeman, nwsli_id: null, county: '' }, null).map((r) => r.label)
    expect(labels).not.toContain('NWS ID')
    expect(labels).not.toContain('County')
  })
})

describe('sensorHistory', () => {
  it('names sensors and their public measurements', () => {
    expect(sensorName({ manufacturer: 'Vaisala', model: 'HMP155E', type: 'RH/T' })).toBe('Vaisala HMP155E (RH/T)')
    expect(sensorName({})).toBe('Unknown sensor')
    expect(measuresText(['air_temp_0200', 'rh'])).toBe('Air Temperature, Relative Humidity')
    expect(measuresText('door')).toBe('')
    expect(measuresText(['soil_vwc_0005', 'soil_ec_perm_0005'])).toBe('Soil VWC @ 2 in')
  })

  it('groups installs and removals by day, newest first, skipping "None" and duplicates', () => {
    const hmpA = { date_start: '2020-10-30', date_end: '2024-08-02', elements: ['air_temp_0200', 'rh'], manufacturer: 'Vaisala', model: 'HMP155A', type: 'RH/T' }
    const hmpE = { date_start: '2024-08-02', date_end: 'None', elements: ['air_temp_0200', 'rh'], manufacturer: 'Vaisala', model: 'HMP155E', type: 'RH/T' }
    const days = sensorHistory([hmpA, hmpE, hmpE])
    expect(days.map((d) => d.label)).toEqual(['Aug 2, 2024', 'Oct 30, 2020'])
    expect(days[0].changes).toEqual([
      { kind: 'installed', sensor: 'Vaisala HMP155E (RH/T)', measures: 'Air Temperature, Relative Humidity' },
      { kind: 'removed', sensor: 'Vaisala HMP155A (RH/T)', measures: 'Air Temperature, Relative Humidity' },
    ])
    expect(days[1].changes.map((c) => c.kind)).toEqual(['installed'])
  })

  it('reads parallel date arrays as one deployment each', () => {
    const days = sensorHistory([{ date_start: ['2021-05-01', '2023-06-01'], date_end: ['2022-01-01', null], model: 'X' }])
    expect(days.map((d) => [d.date, d.changes[0].kind])).toEqual([
      ['2023-06-01', 'installed'],
      ['2022-01-01', 'removed'],
      ['2021-05-01', 'installed'],
    ])
    expect(sensorHistory(undefined)).toEqual([])
  })
})
