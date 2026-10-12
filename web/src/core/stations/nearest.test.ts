import { describe, expect, it } from 'vitest'
import { formatMiles, haversineKm, nearestStations } from './nearest'

const st = (station: string, latitude: number, longitude: number) => ({ station, name: station, sub_network: 'HydroMet', latitude, longitude })

describe('haversineKm', () => {
  it('is zero for the same point and symmetric', () => {
    expect(haversineKm(45.66, -111.07, 45.66, -111.07)).toBe(0)
    expect(haversineKm(45.66, -111.07, 46.87, -114)).toBeCloseTo(haversineKm(46.87, -114, 45.66, -111.07), 9)
  })
  it('Bozeman → Missoula ≈ 265 km', () => {
    expect(haversineKm(45.677, -111.043, 46.872, -113.994)).toBeGreaterThan(260)
    expect(haversineKm(45.677, -111.043, 46.872, -113.994)).toBeLessThan(270)
  })
  it('one degree of latitude ≈ 111.2 km', () => {
    expect(haversineKm(45, -110, 46, -110)).toBeCloseTo(111.2, 0)
  })
})

describe('nearestStations', () => {
  const list = [st('far', 48.5, -104), st('near', 45.7, -111.1), st('mid', 46.5, -112), st('bad', Number.NaN, -110), st('mid2', 45.9, -111.5)]
  it('returns the n nearest, closest first, with km and miles', () => {
    const r = nearestStations(list, 45.66, -111.07, 3)
    expect(r.map((x) => x.station)).toEqual(['near', 'mid2', 'mid'])
    expect(r[0].miles).toBeCloseTo(r[0].km / 1.609344, 9)
  })
  it('defaults to 5 and skips rows without coordinates', () => {
    expect(nearestStations(list, 45.66, -111.07).map((x) => x.station)).toEqual(['near', 'mid2', 'mid', 'far'])
  })
})

describe('formatMiles', () => {
  it('one decimal under 10 mi', () => {
    expect(formatMiles(0.42)).toBe('0.4 mi')
    expect(formatMiles(9.96)).toBe('10.0 mi')
    expect(formatMiles(23.4)).toBe('23 mi')
  })
})
