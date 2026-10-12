import { describe, expect, it } from 'vitest'
import { AG_TOOLS_ANCHOR, DEFAULT_SECTION, SECTIONS, historyMode, legacyRedirect, nextBackTo, parseSection, readBackTo, sectionForHash, sectionLabel, sectionNavPatch } from './router'
import { migrateLegacySearch, readUrlState } from './url-schema'

/** The full boot rewrite, as main.ts runs it: key renames under the old hash, then the redirect. */
const boot = (search: string, hash: string) => {
  const migrated = migrateLegacySearch(search, hash) ?? search
  return legacyRedirect(migrated, hash) ?? { search: migrated, hash }
}

describe('parseSection', () => {
  it('reads the three sections with or without #', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['now', 'charts', 'about'])
    for (const s of SECTIONS) {
      expect(parseSection(`#${s.id}`)).toBe(s.id)
      expect(parseSection(s.id)).toBe(s.id)
    }
  })
  it('defaults to now for empty, unknown and hidden hashes', () => {
    expect(DEFAULT_SECTION).toBe('now')
    expect(parseSection('')).toBe('now')
    expect(parseSection('#')).toBe('now')
    expect(parseSection('#nope')).toBe('now')
    expect(parseSection('#satellite')).toBe('now')
  })
  it('maps old section and tab names to Charts', () => {
    for (const h of ['#latest', '#ag', '#download', '#downloader']) expect(parseSection(h)).toBe('charts')
  })
  it('labels', () => {
    expect(sectionLabel('charts')).toBe('Charts')
  })
})

describe('sectionForHash', () => {
  it('follows section and legacy hashes, and an empty hash means Now', () => {
    expect(sectionForHash('#about', 'charts')).toBe('about')
    expect(sectionForHash('#latest', 'now')).toBe('charts')
    expect(sectionForHash('#ag', 'now')).toBe('charts')
    expect(sectionForHash('#satellite', 'charts')).toBe('now')
    expect(sectionForHash('', 'charts')).toBe('now')
  })
  it('keeps the current section for in-page anchors (skip link #main)', () => {
    expect(sectionForHash('#main', 'charts')).toBe('charts')
    expect(sectionForHash('#whatever', 'about')).toBe('about')
  })
})

describe('historyMode', () => {
  it('pushes section changes and replaces in-section changes', () => {
    expect(historyMode('now', 'charts')).toBe('push')
    expect(historyMode('charts', 'charts')).toBe('replace')
  })
  it('pushes a drill-down inside one section (a variable or Ag tool opened from the list)', () => {
    expect(historyMode('charts', 'charts', true)).toBe('push')
  })
})

describe('legacyRedirect', () => {
  it('#latest → #charts with cmp=1, keeping the Latest keys byte for byte', () => {
    expect(legacyRedirect('?s=acebozem&from=2026-09-01&to=2026-09-30&agg=daily&vars=Air+Temperature,Precipitation&gridmet=true', '#latest')).toEqual({
      search: '?s=acebozem&from=2026-09-01&to=2026-09-30&agg=daily&vars=Air+Temperature,Precipitation&gridmet=true&cmp=1',
      hash: '#charts',
    })
    expect(legacyRedirect('', '#latest')).toEqual({ search: '?cmp=1', hash: '#charts' })
  })
  it('a hash-less link with a Latest-only key opens Compare too', () => {
    expect(legacyRedirect('?s=acebozem&vars=Air+Temperature', '')).toEqual({ search: '?s=acebozem&vars=Air+Temperature&cmp=1', hash: '#charts' })
  })
  it('a bare ?s= link stays on Now', () => {
    expect(legacyRedirect('?s=acebozem', '')).toBeNull()
    expect(legacyRedirect('', '')).toBeNull()
  })
  it('does not add a second cmp', () => {
    expect(legacyRedirect('?cmp=1&s=a', '#latest')).toEqual({ search: '?cmp=1&s=a', hash: '#charts' })
  })

  it('#downloader → #charts&dl=1, after migrateLegacySearch renamed its keys', () => {
    expect(boot('?s=acebozem&from=2026-09-01&to=2026-09-30&els=air_temp', '#downloader')).toEqual({
      search: '?s=acebozem&els=air_temp&dl_from=2026-09-01&dl_to=2026-09-30&dl=1',
      hash: '#charts',
    })
  })
  it('#download → #charts&dl=1 with every dl_*, els, period and qc key kept', () => {
    expect(legacyRedirect('?s=a&els=air_temp,ppt&period=hourly&qc=1&dl_from=2026-09-01&dl_to=2026-09-02', '#download')).toEqual({
      search: '?s=a&els=air_temp,ppt&period=hourly&qc=1&dl_from=2026-09-01&dl_to=2026-09-02&dl=1',
      hash: '#charts',
    })
    expect(legacyRedirect('', '#download')).toEqual({ search: '?dl=1', hash: '#charts' })
  })

  it('#ag&var=<tool> → #charts&v=<tool>, every Ag key kept', () => {
    expect(legacyRedirect('?s=acebozem&var=cci&ag_time=hourly&lt=newborn&ag_from=2026-01-01', '#ag')).toEqual({
      search: '?s=acebozem&ag_time=hourly&lt=newborn&ag_from=2026-01-01&v=cci',
      hash: '#charts',
    })
    expect(legacyRedirect('?s=a&var=soil_temp,soil_ec_blk&soilv=swp', '#ag')).toEqual({ search: '?s=a&soilv=swp&v=soil_temp,soil_ec_blk', hash: '#charts' })
  })
  it('an old #ag link with Ag keys but no var, or an unknown var, opens GDD', () => {
    expect(boot('?s=acebozem&crop=corn', '#ag')).toEqual({ search: '?s=acebozem&crop=corn&v=gdd', hash: '#charts' })
    expect(boot('?s=a&crop=corn&from=2026-05-01', '#ag')).toEqual({ search: '?s=a&crop=corn&ag_from=2026-05-01&v=gdd', hash: '#charts' })
    expect(legacyRedirect('?s=a&var=bogus', '#ag')).toEqual({ search: '?s=a&v=gdd', hash: '#charts' })
  })
  it('the GDD link keeps its crop through parsing', () => {
    const r = boot('?s=acebozem&crop=corn', '#ag')
    expect(readUrlState(r.search)).toMatchObject({ v: 'gdd', crop: 'corn' })
  })
  it('#ag&var=annual → the annv variable page in its All-years view (air temperature without annv)', () => {
    expect(legacyRedirect('?s=a&var=annual&annv=soil_vwc_0400', '#ag')).toEqual({ search: '?s=a&annv=soil_vwc_0400&v=soil_vwc&view=history', hash: '#charts' })
    expect(legacyRedirect('?s=a&var=annual&annv=ppt', '#ag')).toEqual({ search: '?s=a&annv=ppt&v=ppt&view=history', hash: '#charts' })
    expect(legacyRedirect('?s=a&var=annual', '#ag')).toEqual({ search: '?s=a&v=air_temp&view=history', hash: '#charts' })
  })
  it('a bare #ag opens the Charts list at the Ag tools group', () => {
    expect(legacyRedirect('?s=a', '#ag')).toEqual({ search: '?s=a', hash: '#charts', anchor: AG_TOOLS_ANCHOR })
  })
  it('leaves current sections alone', () => {
    expect(legacyRedirect('?s=a&v=gdd', '#charts')).toBeNull()
    expect(legacyRedirect('?s=a&from=2026-01-01', '#charts')).toBeNull()
    expect(legacyRedirect('?s=a&dl=1', '#charts')).toBeNull()
    expect(legacyRedirect('?s=a', '#about')).toBeNull()
  })
})

describe('sectionNavPatch', () => {
  const page = { v: 'air_temp', cmp: false }
  const list = { v: null, cmp: false }
  it('Charts inside Charts goes back to the list (pushed); nothing new at the list', () => {
    expect(sectionNavPatch('charts', 'charts', page)).toEqual({ patch: { v: null, view: 'recent', tbl: false, wd: null, arrays: false, cmp: false }, drillDown: true })
    expect(sectionNavPatch('charts', 'charts', { v: 'gdd', cmp: false }).drillDown).toBe(true)
    expect(sectionNavPatch('charts', 'charts', { ...list, cmp: true }).drillDown).toBe(true)
    expect(sectionNavPatch('charts', 'charts', list).drillDown).toBe(false)
  })
  it('leaving Charts drops the variable and Compare; other moves keep the URL', () => {
    expect(sectionNavPatch('charts', 'now', page)).toEqual({ patch: { v: null, view: 'recent', tbl: false, wd: null, arrays: false, cmp: false }, drillDown: false })
    expect(sectionNavPatch('charts', 'about', { v: null, cmp: true }).patch).toMatchObject({ cmp: false })
    expect(sectionNavPatch('now', 'charts', list)).toEqual({ patch: {}, drillDown: false })
    expect(sectionNavPatch('now', 'about', page)).toEqual({ patch: {}, drillDown: false })
  })
})

describe('back target (a chart opened from Now returns there)', () => {
  const now = { section: 'now' as const, depth: 1 }
  it('a link from Now starts it; drill-downs in Charts carry it one deeper; the list or a section change drops it', () => {
    expect(nextBackTo({ current: null, from: 'now', sameSection: false, drillDown: false, toList: false })).toEqual(now)
    expect(nextBackTo({ current: now, sameSection: true, drillDown: true, toList: false })).toEqual({ section: 'now', depth: 2 })
    expect(nextBackTo({ current: now, sameSection: true, drillDown: true, toList: true })).toBeNull()
    expect(nextBackTo({ current: now, sameSection: false, drillDown: false, toList: false })).toBeNull()
    expect(nextBackTo({ current: null, sameSection: true, drillDown: true, toList: false })).toBeNull()
  })
  it('reads only a well-formed history.state', () => {
    expect(readBackTo({ backTo: { section: 'now', depth: 2 } })).toEqual({ section: 'now', depth: 2 })
    expect(readBackTo(null)).toBeNull()
    expect(readBackTo({ backTo: { section: 'nowhere', depth: 1 } })).toBeNull()
    expect(readBackTo({ backTo: { section: 'now', depth: 0 } })).toBeNull()
  })
})
