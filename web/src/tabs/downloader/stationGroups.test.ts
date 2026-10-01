import { describe, expect, it } from 'vitest'
import type { Station } from '../../lib/api'
import { DL_MARKER_COLORS, groupStations } from './stationGroups'
import { clampStart, dateRangeError } from './request'

const st = (
  station: string,
  name: string,
  sub_network: string,
  lat: number,
  lon: number,
): Station => ({
  station,
  name,
  sub_network,
  latitude: lat,
  longitude: lon,
  date_installed: null,
  elevation: 1000,
  county: 'Gallatin',
  mesowest_id: null,
  gwic_id: null,
  nwsli_id: null,
  has_swp: false,
  funded: true,
})

const STATIONS = [
  st('acebozem', 'Bozeman', 'HydroMet', 45.66, -111.15),
  st('bozmtest', 'Bozeman Test', 'AgriMet', 45.66, -111.15),
  st('lololowr', 'Lolo Lower', 'HydroMet', 46.75, -114.08),
  st('arskeogh', 'Fort Keogh N', 'AgriMet', 46.4, -105.9),
]

describe('groupStations', () => {
  it('merges co-located stations and colours by network (legacy plot_station)', () => {
    const g = groupStations(STATIONS, null)
    expect(g).toHaveLength(3)
    const boz = g.find((x) => x.codes.includes('acebozem'))!
    expect(boz.codes).toEqual(['acebozem', 'bozmtest'])
    expect(boz.longNames).toEqual(['Bozeman (HydroMet)', 'Bozeman Test (AgriMet)'])
    expect(boz.color).toBe(DL_MARKER_COLORS.coLocated)
    expect(g.find((x) => x.codes[0] === 'lololowr')!.color).toBe(DL_MARKER_COLORS.HydroMet)
    expect(g.find((x) => x.codes[0] === 'arskeogh')!.color).toBe(DL_MARKER_COLORS.AgriMet)
  })

  it('marks the group holding the selected station gold', () => {
    const g = groupStations(STATIONS, 'bozmtest')
    const boz = g.find((x) => x.codes.includes('bozmtest'))!
    expect(boz.selected).toBe(true)
    expect(boz.color).toBe(DL_MARKER_COLORS.selected)
    expect(g.filter((x) => x.selected)).toHaveLength(1)
  })
})

describe('clampStart', () => {
  it('clamps a start before the install date', () => {
    expect(clampStart('2015-01-01', '2017-06-01')).toEqual({ start: '2017-06-01', clamped: true })
    expect(clampStart('2018-01-01', '2017-06-01')).toEqual({ start: '2018-01-01', clamped: false })
    expect(clampStart('2018-01-01', null)).toEqual({ start: '2018-01-01', clamped: false })
  })
})

describe('dateRangeError', () => {
  it('distinguishes a clamped start past the end from a plain inverted range', () => {
    const c = clampStart('2015-01-01', '2017-06-01')
    expect(dateRangeError(c.start, '2016-01-01', c.clamped, '2017-06-01')).toBe(
      'This station was installed on 2017-06-01; choose an end date on or after it.',
    )
    expect(dateRangeError('2024-05-01', '2024-04-01', false, '2017-06-01')).toBe(
      'Start date must be on or before the end date.',
    )
    expect(dateRangeError(c.start, '2018-01-01', c.clamped, '2017-06-01')).toBeNull()
  })
})
