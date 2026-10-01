import { describe, expect, it } from 'vitest'
import { migrateLegacySearch } from './url-state'

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
