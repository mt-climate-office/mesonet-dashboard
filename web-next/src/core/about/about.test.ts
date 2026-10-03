import { describe, expect, it } from 'vitest'
import type { Station } from '../api'
import { apiLinks } from './apiLinks'
import { formatCoordinates, formatDay, formatElevation, formatLocation, metersToFeet, periodOfRecord, stationDetails } from './details'
import { pptLabel, pptRows, readingLabel, readingRows, readingValue } from './readings'
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
    expect(formatCoordinates(45.66, -111.07)).toBe('45.66°\u00a0N, 111.07°\u00a0W')
    expect(formatElevation(1495.09)).toBe('4,905\u00a0ft (1,495\u00a0m)')
    expect(formatElevation(Number.NaN)).toBe('—')
    expect(metersToFeet(1000)).toBe(3281)
  })

  it('the record runs to today, the newest report, or "Since" until it arrives', () => {
    expect(periodOfRecord('2020-10-30', '2026-10-01 13:15:00-06:00', '2026-10-01')).toBe('Oct 30, 2020 – today')
    expect(periodOfRecord('2020-10-30', '2026-09-03 13:15:00-06:00', '2026-10-01')).toBe('Oct 30, 2020 – Sep 3, 2026')
    expect(periodOfRecord('2020-10-30', undefined, '2026-10-01')).toBe('Since Oct 30, 2020')
    expect(periodOfRecord(null, '2026-10-01', '2026-10-01')).toBe('—')
  })

  it('lists station, network, location, elevation and record', () => {
    expect(stationDetails(bozeman, '2026-10-01 13:15:00-06:00', '2026-10-02')).toEqual([
      { label: 'Station', value: 'Bozeman', id: 'acebozem' },
      { label: 'Network', value: 'HydroMet' },
      { label: 'Location', value: 'Gallatin County · 45.66°\u00a0N, 111.07°\u00a0W' },
      { label: 'Elevation', value: '4,905\u00a0ft (1,495\u00a0m)' },
      { label: 'Record', value: 'Oct 30, 2020 – Oct 1, 2026' },
    ])
    expect(formatLocation({ ...bozeman, county: '' })).toBe('45.66°\u00a0N, 111.07°\u00a0W')
  })
})

describe('readings', () => {
  it('gives API columns plain labels, with depths', () => {
    expect(readingLabel('Timestamp')).toBe('Observed')
    expect(readingLabel('Air Temperature [°F]')).toBe('Air temperature')
    expect(readingLabel('Soil VWC @ 4 in [%]')).toBe('Soil moisture at 4 in')
    expect(readingLabel('Bulk EC @ 40 in [mS/cm]')).toBe('Soil salinity (EC) at 40 in')
    expect(readingLabel('Gust Speed [mi/hr]')).toBe('Wind gusts')
    expect(readingLabel('Wind Direction [deg]')).toBe('Wind direction')
    expect(readingLabel('Atmospheric Pressure [mbar]')).toBe('Pressure')
    expect(readingLabel('Feels like [°F]')).toBe('Feels like')
    expect(readingLabel('Mystery Thing [zz]')).toBe('Mystery Thing')
  })

  it('puts units on values at table precision, leaving text alone', () => {
    expect(readingValue('Air Temperature [°F]', '56.984')).toBe('57.0 °F')
    // One precision per variable (LABELS digits.table): a whole number keeps its decimal, never "56" beside "70.4".
    expect(readingValue('Air Temperature [°F]', '56')).toBe('56.0 °F')
    expect(readingValue('Bulk EC @ 2 in [mS/cm]', '0.01')).toBe('0.010 mS/cm')
    expect(readingValue('Relative Humidity [%]', '60.38')).toBe('60.4%')
    expect(readingValue('Atmospheric Pressure [mbar]', '848.93')).toBe('848.9 mb')
    expect(readingValue('Feels like [°F]', '41.23 (wind chill)')).toBe('41.2 °F (wind chill)')
    expect(readingValue('Wind Direction [deg]', 'ESE (111.6 deg)')).toBe('ESE (111.6 deg)')
    expect(readingValue('Mystery Thing [zz]', '3.5')).toBe('3.5 zz')
    expect(readingValue('Timestamp', 'Oct 1, 2026 1:15 PM')).toBe('Oct 1, 2026 1:15 PM')
  })

  it('builds the rows, Observed first, keeping each API column', () => {
    const rows = readingRows({ datetime: '2026-10-01 13:15:00-06:00', 'Soil VWC @ 4 in [%]': 13.35 })
    expect(rows).toEqual([
      { col: 'Timestamp', label: 'Observed', value: 'Oct 1, 2026 1:15 PM' },
      { col: 'Soil VWC @ 4 in [%]', label: 'Soil moisture at 4 in', value: '13.4%' },
    ])
  })

  it('names the precipitation periods plainly, newest window first', () => {
    expect(pptLabel('Year to Date Precipitation [in]')).toBe('Year to date')
    expect(pptLabel('180-day Precipitation [in]')).toBe('Last 180 days')
    expect(pptLabel('24-hour Precipitation [in]')).toBe('Last 24 hours')
    expect(pptLabel('Precipitation Since Midnight [in]')).toBe('Since midnight')
    const rows = pptRows({ station: 'acebozem', 'Year to Date Precipitation [in]': 13.119, 'Precipitation Since Midnight [in]': 0 })
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ['Since midnight', '0.00 in'],
      ['Year to date', '13.12 in'],
    ])
  })
})

describe('sensorHistory', () => {
  it('names sensors and their public measurements', () => {
    expect(sensorName({ manufacturer: 'Vaisala', model: 'HMP155E', type: 'RH/T' })).toBe('Vaisala HMP155E (RH/T)')
    expect(sensorName({})).toBe('Unknown sensor')
    expect(measuresText(['air_temp_0200', 'rh'])).toBe('Air temperature, Humidity')
    expect(measuresText('door')).toBe('')
    expect(measuresText(['soil_vwc_0005', 'soil_ec_perm_0005'])).toBe('Soil moisture at 2 in')
  })

  it('groups installs and removals by day, newest first, skipping "None" and duplicates', () => {
    const hmpA = { date_start: '2020-10-30', date_end: '2024-08-02', elements: ['air_temp_0200', 'rh'], manufacturer: 'Vaisala', model: 'HMP155A', type: 'RH/T' }
    const hmpE = { date_start: '2024-08-02', date_end: 'None', elements: ['air_temp_0200', 'rh'], manufacturer: 'Vaisala', model: 'HMP155E', type: 'RH/T' }
    const days = sensorHistory([hmpA, hmpE, hmpE])
    expect(days.map((d) => d.label)).toEqual(['Aug 2, 2024', 'Oct 30, 2020'])
    expect(days[0].changes).toEqual([
      { kind: 'installed', sensor: 'Vaisala HMP155E (RH/T)', measures: 'Air temperature, Humidity' },
      { kind: 'removed', sensor: 'Vaisala HMP155A (RH/T)', measures: 'Air temperature, Humidity' },
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

describe('apiLinks', () => {
  it('points at the public API for this station', () => {
    expect(apiLinks('acebozem', 'https://api.example/v2/').map((l) => l.href)).toEqual([
      'https://mesonet2.climate.umt.edu/api/v2/docs',
      'https://api.example/v2/latest?stations=acebozem&type=csv',
      'https://api.example/v2/config/acebozem/',
    ])
  })
})
