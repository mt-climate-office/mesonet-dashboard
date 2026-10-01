import { describe, expect, it } from 'vitest'
import { isKnownStation, isTrueFlag, resolveStationId, stationHasSwp, stationsWithSwp } from './stations'

const stations = [
  { station: 'aceabsar', nwsli_id: 'KEEM8', has_swp: 'True' as unknown as boolean },
  { station: 'acealbio', nwsli_id: null, has_swp: 'False' as unknown as boolean },
  { station: 'arskeogh', nwsli_id: ' MLSM8 ', has_swp: true },
  { station: 'blmround', nwsli_id: '', has_swp: false },
]

describe('isTrueFlag', () => {
  it('reads Python-style CSV booleans', () => {
    expect(isTrueFlag('True')).toBe(true)
    expect(isTrueFlag('False')).toBe(false)
    expect(isTrueFlag('true')).toBe(true)
    expect(isTrueFlag(true)).toBe(true)
    expect(isTrueFlag(false)).toBe(false)
    expect(isTrueFlag(1)).toBe(true)
    expect(isTrueFlag(0)).toBe(false)
    expect(isTrueFlag(null)).toBe(false)
    expect(isTrueFlag(undefined)).toBe(false)
    expect(isTrueFlag('')).toBe(false)
  })
})

describe('stationsWithSwp', () => {
  it('keeps only has_swp stations, including string "True"', () => {
    expect(stationsWithSwp(stations).map((s) => s.station)).toEqual([
      'aceabsar',
      'arskeogh',
    ])
  })
  it('handles empty input', () => {
    expect(stationsWithSwp([])).toEqual([])
  })
  it('stationHasSwp', () => {
    expect(stationHasSwp(stations[0])).toBe(true)
    expect(stationHasSwp(stations[1])).toBe(false)
    expect(stationHasSwp(null)).toBe(false)
  })
})

describe('resolveStationId', () => {
  it('keeps an exact station id', () => {
    expect(resolveStationId('aceabsar', stations)).toBe('aceabsar')
  })
  it('matches station ids case-insensitively', () => {
    expect(resolveStationId('ACEABSAR', stations)).toBe('aceabsar')
  })
  it('falls back to NWSLI ids, case-insensitively and trimmed', () => {
    expect(resolveStationId('KEEM8', stations)).toBe('aceabsar')
    expect(resolveStationId('keem8', stations)).toBe('aceabsar')
    expect(resolveStationId('mlsm8', stations)).toBe('arskeogh')
  })
  it('prefers a station id over an NWSLI id', () => {
    const tricky = [
      { station: 'abc', nwsli_id: 'xyz' },
      { station: 'xyz', nwsli_id: null },
    ]
    expect(resolveStationId('xyz', tricky)).toBe('xyz')
  })
  it('returns null when nothing matches', () => {
    expect(resolveStationId('nope', stations)).toBeNull()
    expect(resolveStationId('', stations)).toBeNull()
    expect(resolveStationId(null, stations)).toBeNull()
  })
})

describe('isKnownStation', () => {
  it('matches exact catalog ids only', () => {
    expect(isKnownStation('aceabsar', stations)).toBe(true)
    expect(isKnownStation('KEEM8', stations)).toBe(false)
    expect(isKnownStation('ACEABSAR', stations)).toBe(false)
    expect(isKnownStation(null, stations)).toBe(false)
  })
})
