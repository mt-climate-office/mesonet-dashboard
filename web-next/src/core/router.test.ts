import { describe, expect, it } from 'vitest'
import { DEFAULT_SECTION, SECTIONS, historyMode, legacyRedirect, parseSection, sectionForHash, sectionLabel } from './router'
import { migrateLegacySearch } from './url-schema'

describe('parseSection', () => {
  it('reads the five sections with or without #', () => {
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
  it('maps legacy tab names', () => {
    expect(parseSection('#latest')).toBe('charts')
    expect(parseSection('#downloader')).toBe('download')
    expect(parseSection('#ag')).toBe('ag')
  })
  it('labels', () => {
    expect(sectionLabel('download')).toBe('Download')
  })
})

describe('sectionForHash', () => {
  it('follows section and legacy hashes, and an empty hash means Now', () => {
    expect(sectionForHash('#about', 'charts')).toBe('about')
    expect(sectionForHash('#latest', 'now')).toBe('charts')
    expect(sectionForHash('#satellite', 'charts')).toBe('now')
    expect(sectionForHash('', 'charts')).toBe('now')
  })
  it('keeps the current section for in-page anchors (skip link #main)', () => {
    expect(sectionForHash('#main', 'charts')).toBe('charts')
    expect(sectionForHash('#whatever', 'ag')).toBe('ag')
  })
})

describe('historyMode', () => {
  it('pushes section changes and replaces in-section changes', () => {
    expect(historyMode('now', 'charts')).toBe('push')
    expect(historyMode('charts', 'charts')).toBe('replace')
  })
  it('pushes a drill-down inside one section (an Ag tool opened from its card)', () => {
    expect(historyMode('ag', 'ag', true)).toBe('push')
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
  it('#downloader → #download, after migrateLegacySearch renamed its keys', () => {
    const search = migrateLegacySearch('?s=acebozem&from=2026-09-01&to=2026-09-30&els=air_temp', '#downloader')
    expect(search).toBe('?s=acebozem&els=air_temp&dl_from=2026-09-01&dl_to=2026-09-30')
    expect(legacyRedirect(search!, '#downloader')).toEqual({ search: search!, hash: '#download' })
  })
  it('an old #ag link with Ag keys but no var opens GDD; a bare #ag opens the tool cards', () => {
    const search = migrateLegacySearch('?s=a&crop=corn&from=2026-05-01', '#ag')
    expect(legacyRedirect(search!, '#ag')).toEqual({ search: `${search}&var=gdd`, hash: '#ag' })
    expect(legacyRedirect('?s=a', '#ag')).toBeNull()
  })
  it('leaves current sections and #ag alone', () => {
    expect(legacyRedirect('?s=a&var=gdd', '#ag')).toBeNull()
    expect(legacyRedirect('?s=a&from=2026-01-01', '#charts')).toBeNull()
    expect(legacyRedirect('?s=a', '#download')).toBeNull()
  })
})
