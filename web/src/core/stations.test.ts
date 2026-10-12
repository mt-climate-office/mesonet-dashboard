import { describe, expect, it } from 'vitest'
import soilJsonText from '../../public/data/soil_params.json?raw'
import { fromVendoredJson, type VendoredSoilJson } from './ag/data/soilParams'
import { confirmedStation, isKnownStation, isTrueFlag, resolveStationId, stationHasSwp, stationsWithSwp, swpStationIds, withSwpFlags } from './stations'

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

describe('has_swp from the mesonet-soils parameters', () => {
  const fx = { r: 0, s: 0.5, n: 1, m: 1, h: 1 }
  it('a station has SWP when it has at least one FX row', () => {
    const ids = swpStationIds([
      { station: 'a', fx },
      { station: 'b' }, // VG-only
      { station: 'c', fx: undefined },
      { station: 'c', fx },
    ])
    expect([...ids].sort()).toEqual(['a', 'c'])
  })
  it('withSwpFlags overrides the catalog flag (mesonet2 has none) and keeps the rows otherwise', () => {
    const out = withSwpFlags(stations, new Set(['acealbio', 'blmround']))
    expect(out.map((s) => [s.station, s.has_swp])).toEqual([
      ['aceabsar', false],
      ['acealbio', true],
      ['arskeogh', false],
      ['blmround', true],
    ])
    expect(out[0].nwsli_id).toBe('KEEM8')
    expect(stations[0].has_swp).toBe('True') // input untouched
  })
  it('the vendored bundle covers the legacy has_swp stations used in tests', () => {
    const ids = swpStationIds(fromVendoredJson(JSON.parse(soilJsonText) as VendoredSoilJson))
    for (const id of ['acebozem', 'arskeogh', 'mdamalta', 'acerapl2']) expect(ids.has(id)).toBe(true)
    expect(ids.has('acerapel')).toBe(false)
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

describe('confirmedStation', () => {
  it('waits for the catalog, then passes only catalog ids; falls back to the raw param on failure', () => {
    expect(confirmedStation('aceabsar', undefined, false)).toBeNull()
    expect(confirmedStation('aceabsar', stations, false)).toBe('aceabsar')
    expect(confirmedStation('KEEM8', stations, false)).toBeNull()
    expect(confirmedStation('KEEM8', undefined, true)).toBe('KEEM8')
    expect(confirmedStation(null, stations, false)).toBeNull()
  })
})
