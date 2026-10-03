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
    expect(s.v).toBeNull()
    expect(s.dl).toBe(false)
    expect(s.qc).toBeNull()
    expect(s.pct).toBe(true)
  })

  it('rejects values outside an enum and keeps `vars=` as an explicit empty list', () => {
    const s = readUrlState('?agg=weekly&vars=&qc=7&theme=sepia')
    expect(s.agg).toBe('hourly')
    expect(s.vars).toEqual([])
    expect(s.qc).toBeNull()
    expect(s.theme).toBeNull()
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

  it('v holds element families and Ag tools alike; any value is written, gdd included', () => {
    const d = readUrlState('')
    expect(writeUrlSearch({ ...d, v: 'gdd' })).toBe('?v=gdd')
    expect(writeUrlSearch({ ...d, v: 'soil_temp,soil_ec_blk' })).toBe('?v=soil_temp,soil_ec_blk')
    expect(writeUrlSearch({ ...d, v: null }, '?v=etr')).toBe('')
  })

  it('dl: 1 opens the Download sheet; closed is absent', () => {
    expect(readUrlState('?dl=1').dl).toBe(true)
    expect(readUrlState('?dl=0').dl).toBe(false)
    expect(writeUrlSearch({ ...readUrlState(''), dl: true })).toBe('?dl=1')
    expect(writeUrlSearch({ ...readUrlState(''), dl: false }, '?dl=1')).toBe('')
  })

  it('an old `var` key is no longer in the schema, so it is kept as-is', () => {
    expect(writeUrlSearch(readUrlState('?var=etr'), '?var=etr')).toBe('?var=etr')
  })

  it('keeps non-schema keys and round-trips', () => {
    const qs = '?state=abc&s=acebozem&els=air_temp,ppt&period=hourly&kbd=off'
    const out = writeUrlSearch(readUrlState(qs), qs)
    expect(out).toBe('?state=abc&kbd=off&s=acebozem&els=air_temp,ppt&period=hourly')
    expect(readUrlState(out)).toEqual(readUrlState(qs))
  })

  it('an old Latest link keeps card/info (no longer in the schema) through a write', () => {
    const qs = '?s=acebozem&card=photo&info=map'
    expect(writeUrlSearch({ ...readUrlState(qs), s: 'aceabsar' }, qs)).toBe('?card=photo&info=map&s=aceabsar')
  })

  it('latestVars resolves absent to the defaults; selectStationPatch sets the station', () => {
    expect(latestVars({ vars: null })).toHaveLength(5)
    expect(latestVars({ vars: [] })).toEqual([])
    expect(selectStationPatch('x')).toEqual({ s: 'x' })
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
})

describe('cmp (Charts → Compare)', () => {
  it('reads 1 or true, writes 1, omits the default', () => {
    expect(readUrlState('').cmp).toBe(false)
    expect(readUrlState('?cmp=1').cmp).toBe(true)
    expect(readUrlState('?cmp=TRUE').cmp).toBe(true)
    expect(readUrlState('?cmp=0').cmp).toBe(false)
    expect(writeUrlSearch({ ...readUrlState('?s=a'), cmp: false })).toBe('?s=a')
    expect(writeUrlSearch({ ...readUrlState('?s=a'), cmp: true })).toBe('?s=a&cmp=1')
  })
})

describe('v / view (Charts → variable page)', () => {
  it('reads the variable id and sub-view; recent is the default and stays out of the URL', () => {
    expect(readUrlState('').v).toBeNull()
    expect(readUrlState('?v=air_temp&view=history')).toMatchObject({ v: 'air_temp', view: 'history' })
    expect(readUrlState('?view=nope').view).toBe('recent')
    expect(writeUrlSearch({ ...readUrlState('?s=a'), v: 'ppt', view: 'recent' })).toBe('?s=a&v=ppt')
    expect(writeUrlSearch({ ...readUrlState('?s=a'), v: 'ppt', view: 'table' })).toBe('?s=a&v=ppt&view=table')
  })
})
