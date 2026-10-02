import { describe, expect, it } from 'vitest'
import {
  latestVars,
  migrateLegacySearch,
  readUrlState,
  selectStationPatch,
  stationPathRedirect,
  viewHref,
  writeUrlSearch,
} from './url-schema'

describe('readUrlState / writeUrlSearch', () => {
  it('fills defaults for absent keys', () => {
    const s = readUrlState('')
    expect(s.s).toBeNull()
    expect(s.agg).toBe('hourly')
    expect(s.vars).toBeNull()
    expect(s.nets).toEqual(['HydroMet', 'AgriMet', 'Cooperator'])
    expect(s.var).toBe('gdd')
    expect(s.qc).toBeNull()
    expect(s.pct).toBe(true)
  })

  it('rejects values outside an enum and keeps `vars=` as an explicit empty list', () => {
    const s = readUrlState('?agg=weekly&vars=&qc=7&theme=sepia&card=photo')
    expect(s.agg).toBe('hourly')
    expect(s.vars).toEqual([])
    expect(s.qc).toBeNull()
    expect(s.theme).toBeNull()
    expect(s.card).toBe('photo')
    expect(readUrlState('?qc=0').qc).toBe(0)
    expect(readUrlState('?gridmet=TRUE').gridmet).toBe(true)
  })

  it('omits defaults: an all-defaults view is a clean URL', () => {
    expect(writeUrlSearch(readUrlState(''))).toBe('')
    const s = {
      ...readUrlState(''),
      s: 'acebozem',
      agg: 'daily' as const,
      vars: ['Air Temperature', 'Precipitation'],
    }
    expect(writeUrlSearch(s)).toBe('?s=acebozem&agg=daily&vars=Air+Temperature,Precipitation')
    expect(writeUrlSearch({ ...readUrlState(''), vars: [] })).toBe('?vars=')
  })

  it('Ag var stays at its default once set or present (nuqs clearOnDefault: false)', () => {
    const d = readUrlState('')
    expect(writeUrlSearch(d, '', new Set(['var']))).toBe('?var=gdd')
    expect(writeUrlSearch(d, '?var=etr')).toBe('?var=gdd')
    expect(writeUrlSearch({ ...d, crop: 'wheat' }, '', new Set(['crop']))).toBe('')
  })

  it('keeps non-schema keys and round-trips', () => {
    const qs = '?state=abc&s=acebozem&els=air_temp,ppt&period=hourly&kbd=off'
    const out = writeUrlSearch(readUrlState(qs), qs)
    expect(out).toBe('?state=abc&kbd=off&s=acebozem&els=air_temp,ppt&period=hourly')
    expect(readUrlState(out)).toEqual(readUrlState(qs))
  })

  it('latestVars resolves absent to the defaults; selectStationPatch resets cards', () => {
    expect(latestVars({ vars: null })).toHaveLength(5)
    expect(latestVars({ vars: [] })).toEqual([])
    expect(selectStationPatch('x')).toEqual({ s: 'x', card: null, info: null })
  })
})

describe('stationPathRedirect', () => {
  const base = '/mesonet-dashboard/next'
  it('turns /<base>/<id> into ?s=<id>, keeping query and hash', () => {
    expect(stationPathRedirect(`${base}/acebozem`, '?agg=daily', '#ag', base)).toBe(
      `${base}/?agg=daily&s=acebozem#ag`,
    )
    expect(stationPathRedirect(`${base}/acebozem/`, '?s=other', '', base)).toBe(`${base}/?s=other`)
  })
  it('ignores the index, nested paths and odd segments', () => {
    expect(stationPathRedirect(`${base}/`, '', '', base)).toBeNull()
    expect(stationPathRedirect(`${base}/a/b`, '', '', base)).toBeNull()
    expect(stationPathRedirect(`${base}/a.html`, '', '', base)).toBeNull()
    expect(stationPathRedirect('/elsewhere/x', '', '', base)).toBeNull()
  })
})

const parse = (qs: string | null) => Object.fromEntries(new URLSearchParams(qs ?? ''))

describe('migrateLegacySearch', () => {
  it('moves Ag legacy keys', () => {
    const out = migrateLegacySearch(
      '?s=acebozem&from=2026-06-01&to=2026-06-30&var=etr&time=hourly',
      '#ag',
    )
    expect(parse(out)).toEqual({
      s: 'acebozem',
      var: 'etr',
      ag_from: '2026-06-01',
      ag_to: '2026-06-30',
      ag_time: 'hourly',
    })
  })

  it('moves Downloader from/to', () => {
    expect(parse(migrateLegacySearch('s=x&from=2026-01-01&to=2026-02-01', 'downloader'))).toEqual({
      s: 'x',
      dl_from: '2026-01-01',
      dl_to: '2026-02-01',
    })
  })

  it('moves Satellite vars/from/to', () => {
    expect(parse(migrateLegacySearch('?vars=ET,NDVI&from=2025-01-01', '#satellite'))).toEqual({
      sat_vars: 'ET,NDVI',
      sat_from: '2025-01-01',
    })
  })

  it('does not touch Latest (or unknown / empty hash)', () => {
    const qs = '?s=acebozem&from=2026-06-01&to=2026-06-30&vars=Precipitation'
    expect(migrateLegacySearch(qs, '#latest')).toBeNull()
    expect(migrateLegacySearch(qs, '')).toBeNull()
    expect(migrateLegacySearch(qs, '#nope')).toBeNull()
  })

  it('returns null when there is nothing to migrate', () => {
    expect(migrateLegacySearch('?s=acebozem&var=gdd&crop=corn', '#ag')).toBeNull()
    expect(migrateLegacySearch('', '#ag')).toBeNull()
  })

  it('never overwrites a namespaced key that is already present', () => {
    const out = migrateLegacySearch('?from=2020-01-01&ag_from=2026-06-01&to=2026-06-30', '#ag')
    expect(parse(out)).toEqual({
      from: '2020-01-01',
      ag_from: '2026-06-01',
      ag_to: '2026-06-30',
    })
    expect(migrateLegacySearch('?from=2020-01-01&ag_from=2026-06-01', '#ag')).toBeNull()
  })

  it('returns an empty string when only legacy keys were present and moved', () => {
    expect(migrateLegacySearch('?time=hourly', '#ag')).toBe('?ag_time=hourly')
  })
})

describe('viewHref', () => {
  const loc = (search: string, hash = '#latest') => ({
    origin: 'https://mt-climate-office.github.io',
    pathname: '/mesonet-dashboard/next/',
    search,
    hash,
  })
  const BASE = 'https://mt-climate-office.github.io/mesonet-dashboard/next/'
  it('serializes the store state, keeping path, hash and unknown keys', () => {
    const state = { ...readUrlState('?s=acebozem'), s: 'aceabsar' }
    expect(viewHref(loc('?s=acebozem&kbd=off', '#ag'), state)).toBe(`${BASE}?kbd=off&s=aceabsar#ag`)
  })
  it('gives a clean URL for an all-defaults view', () => {
    expect(viewHref(loc(''), readUrlState(''))).toBe(`${BASE}#latest`)
  })
  it('reflects a write the store has not flushed yet', () => {
    expect(viewHref(loc(''), { ...readUrlState(''), s: 'acebozem' })).toBe(`${BASE}?s=acebozem#latest`)
  })
  it('passes touched keys through (Ag var pinned at its default)', () => {
    const d = readUrlState('')
    expect(viewHref(loc('', '#ag'), d)).toBe(`${BASE}#ag`)
    expect(viewHref(loc('', '#ag'), d, new Set(['var']))).toBe(`${BASE}?var=${d.var}#ag`)
  })
})
