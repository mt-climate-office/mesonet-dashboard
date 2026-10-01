import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkParams, enforceAllowlist, matchEndpoint } from './http'
import { getDerived, getDerivedSoil } from './derived'
import {
  getElements,
  getPptSummary,
  getStationConfig,
  getStationElements,
  getStationLatest,
  getStations,
} from './meta'
import { getPhotoCatalog } from './photos'
import { getStationRecord } from './record'
import {
  dailyMetRequest,
  hourlyMetRequest,
  soilRequest,
} from '../../features/ag/data/observations'
import type { AggPeriod } from '../params'

describe('matchEndpoint', () => {
  it('normalises slashes and resolves templates', () => {
    expect(matchEndpoint('observations/daily')).toBe('/observations/daily/')
    expect(matchEndpoint('/observations/daily/')).toBe('/observations/daily/')
    expect(matchEndpoint('observations')).toBe('/observations/')
    expect(matchEndpoint('elements/acebozem/')).toBe('/elements/{station}/')
    expect(matchEndpoint('elements')).toBe('/elements/')
    expect(matchEndpoint('photos/aceabsar/n/')).toBe('/photos/{station}/{direction}/')
    expect(matchEndpoint('derived/swp')).toBe('/derived/swp/')
    expect(matchEndpoint('derived/ppt/')).toBe('/derived/ppt/')
    expect(matchEndpoint('nope/nothing')).toBeNull()
  })
})

describe('enforceAllowlist', () => {
  it('throws in dev on a param the spec does not list (premade)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      enforceAllowlist('derived/daily', { stations: 'x', premade: true }, true),
    ).toThrow(/does not accept premade/)
    err.mockRestore()
  })
  it('drops + warns in prod', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(enforceAllowlist('derived/daily', { stations: 'x', premade: true }, false)).toEqual({
      stations: 'x',
    })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
  it('ignores params buildQuery would drop', () => {
    expect(checkParams('stations', { premade: undefined, x: null, y: '' })).toBeNull()
  })
  it('hidden derived/swp route is allowed', () => {
    expect(checkParams('derived/swp', { stations: 'acebozem', type: 'csv' })).toBeNull()
  })
})

/* Every existing call site goes through buildUrl → enforceAllowlist (dev = throw). */
describe('existing call sites respect the allowlist', () => {
  const seen: string[] = []
  beforeEach(() => {
    seen.length = 0
    vi.stubGlobal('fetch', async (url: string) => {
      seen.push(url)
      return new Response('station,datetime\nacebozem,2026-01-01 00:00:00-07:00\n', {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      })
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('meta + photos', async () => {
    await getStations()
    await getElements()
    await getStationElements('acebozem')
    await getStationLatest('acebozem')
    await getPptSummary('acebozem')
    await getPhotoCatalog()
    vi.stubGlobal('fetch', async () => Response.json({}))
    await getStationConfig('acebozem')
  })

  it.each(['hourly', 'daily', 'monthly', 'raw'] as AggPeriod[])(
    'getStationRecord %s passes the allowlist',
    async (period) => {
      await getStationRecord({
        station: 'acebozem',
        start: '2026-01-01',
        end: '2026-01-02',
        period,
        elements: 'air_temp',
        hasEtr: true,
        derivedElems: ['feels_like'],
        naInfo: true,
      })
      expect(seen.length).toBe(3)
      const obs = new URL(seen[0], 'http://x')
      // Raw /observations/ has no na_info; the aggregate endpoints keep it.
      expect(obs.searchParams.has('na_info')).toBe(period !== 'raw')
    },
  )

  it('getDerived / getDerivedSoil (daily + hourly)', async () => {
    for (const time of ['daily', 'hourly'] as const) {
      for (const variable of ['etr', 'feels_like', 'cci', 'swp', 'soil_vwc']) {
        await getDerived({ station: 'acebozem', variable, start: '2026-01-01', end: '2026-01-02', time })
      }
      await getDerivedSoil({ station: 'acebozem', variable: 'soil_vwc', start: '2026-01-01', end: '2026-01-02', time })
    }
    await getDerived({ station: 'acebozem', variable: 'gdd', crop: 'wheat', start: '2026-01-01', end: '2026-01-02', time: 'daily' })
  })

  it('Ag data layer requests', () => {
    const q = { station: 'acebozem', start: '2026-01-01', end: '2026-01-02' }
    for (const r of [dailyMetRequest(q), hourlyMetRequest(q), soilRequest(q, 'daily'), soilRequest(q, 'hourly')]) {
      expect(checkParams(r.path, { ...r.query, type: 'csv' })).toBeNull()
    }
  })
})
