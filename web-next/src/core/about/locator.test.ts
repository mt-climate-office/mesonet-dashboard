import { describe, expect, it } from 'vitest'
import { locatorFrame } from './locator'

const at = (station: string, latitude: number, longitude: number) => ({ station, latitude, longitude })
const bozeman = at('acebozem', 45.66, -111.07)
const bozemanTest = at('bozmtest', 45.66, -111.07) // the same site
const manhattan = at('mdamanha', 45.79, -111.32) // ~24 km
const brisbin = at('pvbrisbi', 45.53, -110.61) // ~39 km
const missoula = at('missoula', 46.87, -114.0) // ~260 km

describe('locatorFrame', () => {
  it('is null for an unknown or missing station', () => {
    expect(locatorFrame([bozeman], null)).toBeNull()
    expect(locatorFrame([bozeman], 'nope')).toBeNull()
    expect(locatorFrame([at('x', Number.NaN, -111)], 'x')).toBeNull()
  })

  it('reaches the nearest other site, centred on the station', () => {
    const [[w, s], [e, n]] = locatorFrame([bozeman, bozemanTest, brisbin, manhattan, missoula], 'acebozem')!
    expect((w + e) / 2).toBeCloseTo(-111.07, 9)
    expect((s + n) / 2).toBeCloseTo(45.66, 9)
    expect(w).toBeCloseTo(-111.32, 9)
    expect(n).toBeCloseTo(45.66 + 15 / 111.2, 9) // the 15 km minimum is taller than Manhattan's 0.13°
  })

  it('reaches more neighbours on request', () => {
    const [[w], [e]] = locatorFrame([bozeman, brisbin, manhattan, missoula], 'acebozem', { neighbours: 2 })!
    expect(e).toBeCloseTo(-110.61, 9)
    expect(w).toBeCloseTo(-111.53, 9)
  })

  it('keeps a minimum span around a station with a close neighbour', () => {
    const [[w, s], [e, n]] = locatorFrame([bozeman, at('near', 45.661, -111.071)], 'acebozem')!
    expect(n - s).toBeCloseTo(30 / 111.2, 6)
    expect(e - w).toBeGreaterThan(n - s) // a degree of longitude is shorter at 45° N
  })
})
