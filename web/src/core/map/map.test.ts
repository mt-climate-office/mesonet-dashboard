import { describe, expect, it } from 'vitest'
import type { Station } from '../api'
import type { Theme } from '../palette'
import { TOKENS_SNAPSHOT } from '../palette/tokens.snapshot'
import {
  asNetwork,
  formatElevation,
  legendRows,
  markerProps,
  popupLines,
  selectedSite,
  selectionAnnouncement,
  siteOf,
  stationRank,
  stationRows,
  visibleStations,
  type MarkerCollection,
} from './index'

const st = (station: string, over: Partial<Station> = {}): Station => ({
  station,
  name: station.toUpperCase(),
  date_installed: null,
  sub_network: 'HydroMet',
  longitude: -110,
  latitude: 46,
  elevation: 1400.4,
  county: 'Gallatin',
  mesowest_id: null,
  gwic_id: null,
  nwsli_id: null,
  has_swp: false,
  funded: true,
  ...over,
})

// The Bozeman pair is co-located, as in the live catalog; its AgriMet sits 2 m off (same 4-decimal
// bucket), which the old exact-equality grouping split into two markers.
const CATALOG: Station[] = [
  st('acebozem', { name: 'Bozeman', longitude: -111.05, latitude: 45.66 }),
  st('bozmtest', { name: 'Bozeman AgriMet', sub_network: 'AgriMet', longitude: -111.05002, latitude: 45.66001 }),
  st('aceabsar', { name: 'Absarokee', longitude: -109.61, latitude: 45.56, county: 'Stillwater' }),
  st('wsrfoo', { name: 'Foo', sub_network: 'AgriMet', longitude: -108, latitude: 47, county: '' }),
  st('nocoords', { latitude: Number.NaN }),
]

const TOKENS: Record<Theme, Record<string, string>> = {
  dark: { '--dot-stroke': '#ffffff', '--accent': '#1a6faf', '--text-on-accent': '#ffffff' },
  light: { '--dot-stroke': '#2a2a3a', '--accent': '#1a6faf', '--text-on-accent': '#ffffff' },
  'high-contrast': { '--dot-stroke': '#ffffff', '--accent': '#ffd200', '--text-on-accent': '#000000' },
}
const getVar = (theme: Theme) => (name: string) => TOKENS[theme][name] ?? TOKENS_SNAPSHOT[theme][name] ?? ''

/**
 * The features the map draws: the kit's own MCO.map.colocation (the pinned bytes, test/kit.ts) over a
 * stub map, with the app's rank and properties, as ui/map/stationLayer.ts wires it.
 */
function drawn(selected: string | null = null, visible: ReadonlySet<string> | null = null): MarkerCollection {
  const stub = { getSource: () => undefined, on() {}, getCanvas: () => ({ addEventListener() {} }) }
  const site = selectedSite(CATALOG, visible, selected)
  const coloc = MCO.map.colocation(stub as never, {
    source: 'stations',
    rank: stationRank,
    visible: (s: Station) => (visible === null || visible.has(s.station)) && Number.isFinite(s.latitude),
    properties: (s: Station) => markerProps(s, selected, site),
    interactive: false,
  } as never)
  return coloc.setData(CATALOG) as unknown as MarkerCollection
}

describe('asNetwork / stationRank', () => {
  it('keeps the networks and maps anything else to HydroMet (legacy rule)', () => {
    expect(asNetwork('AgriMet')).toBe('AgriMet')
    expect(asNetwork('Cooperator')).toBe('Cooperator')
    expect(asNetwork('Something')).toBe('HydroMet')
  })
  it('ranks HydroMet first, so it anchors a shared site', () => {
    expect(CATALOG.slice(0, 2).map(stationRank)).toEqual([0, 1])
    expect(stationRank(st('x', { sub_network: 'Cooperator' }))).toBe(2)
  })
})

describe('siteOf / selectedSite / markerProps', () => {
  it('is the kit bucket: 4 decimals, so stations a few metres apart share a site', () => {
    expect(siteOf(CATALOG[0])).toBe('45.6600,-111.0500')
    expect(siteOf(CATALOG[1])).toBe(siteOf(CATALOG[0]))
    expect(siteOf(CATALOG[2])).not.toBe(siteOf(CATALOG[0]))
  })
  it('gives no site to a selection the filter hides', () => {
    expect(selectedSite(CATALOG, null, 'bozmtest')).toBe('45.6600,-111.0500')
    expect(selectedSite(CATALOG, new Set(['acebozem']), 'bozmtest')).toBeNull()
    expect(selectedSite(CATALOG, null, null)).toBeNull()
    expect(selectedSite(CATALOG, null, 'nope')).toBeNull()
  })
  it('marks the selected station and every station at its site', () => {
    const site = selectedSite(CATALOG, null, 'bozmtest')
    expect(markerProps(CATALOG[0], 'bozmtest', site)).toEqual({ station: 'acebozem', selected: 0, siteSelected: 1 })
    expect(markerProps(CATALOG[1], 'bozmtest', site)).toEqual({ station: 'bozmtest', selected: 1, siteSelected: 1 })
    expect(markerProps(CATALOG[2], 'bozmtest', site)).toEqual({ station: 'aceabsar', selected: 0, siteSelected: 0 })
  })
})

describe('the drawn features (kit MCO.map.colocation with the app rank)', () => {
  it('makes one stacked site with a HydroMet anchor and drops rows without coordinates', () => {
    const fc = drawn()
    const anchors = fc.features.filter((f) => f.properties.colocationIndex === 0)
    expect(anchors.map((f) => [f.properties.station, f.properties.colocationCount])).toEqual([
      ['acebozem', 2],
      ['aceabsar', 1],
      ['wsrfoo', 1],
    ])
    expect(fc.features.find((f) => f.properties.station === 'bozmtest')?.properties.colocationIndex).toBe(1)
  })
  it('turns a pair into a plain dot when the filter hides one', () => {
    const fc = drawn(null, new Set(['bozmtest', 'wsrfoo']))
    expect(fc.features.map((f) => [f.properties.station, f.properties.colocationCount, f.properties.colocationIndex])).toEqual([
      ['bozmtest', 1, 0],
      ['wsrfoo', 1, 0],
    ])
  })
})

describe('text models', () => {
  const byId = new Map(CATALOG.map((s) => [s.station, s]))

  it('formats elevation in whole metres and feet', () => {
    expect(formatElevation(1400)).toBe('1,400 m (4,593 ft)')
    expect(formatElevation(1400.4)).toBe('1,400 m (4,594 ft)')
    expect(formatElevation(0)).toBe('0 m (0 ft)')
    expect(formatElevation(Number.NaN)).toBeNull()
    expect(formatElevation(null)).toBeNull()
  })

  it('builds popup lines per member, skipping unknown ids', () => {
    expect(popupLines(['acebozem', 'bozmtest', 'ghost'], byId)).toEqual([
      { name: 'Bozeman', detail: 'HydroMet · 1,400 m (4,594 ft)' },
      { name: 'Bozeman AgriMet', detail: 'AgriMet · 1,400 m (4,594 ft)' },
    ])
  })

  it('keeps markup in names as plain text (the UI uses textContent)', () => {
    const evil = st('evil', { name: '<b>Bold</b><img src=x onerror=alert(1)>' })
    expect(popupLines(['evil'], new Map([['evil', evil]]))[0].name).toBe('<b>Bold</b><img src=x onerror=alert(1)>')
  })

  it('sorts table rows by name and fills a missing county', () => {
    const rows = stationRows(visibleStations(CATALOG, null))
    expect(rows.map((r) => r.id)).toEqual(['aceabsar', 'acebozem', 'bozmtest', 'wsrfoo'])
    expect(rows[3]).toEqual({ id: 'wsrfoo', name: 'Foo', network: 'AgriMet', county: '—' })
  })

  it('announces a selection', () => {
    expect(selectionAnnouncement(byId.get('acebozem'))).toBe('Selected Bozeman (acebozem), HydroMet, Gallatin County.')
    expect(selectionAnnouncement(byId.get('wsrfoo'))).toBe('Selected Foo (wsrfoo), AgriMet.')
    expect(selectionAnnouncement(undefined)).toBe('No station selected.')
  })
})

describe('legendRows', () => {
  it('has one station row (no network rows), the co-located row with its badge and site count, and the ring', () => {
    const rows = legendRows(drawn(), 'dark', getVar('dark'))
    expect(rows.map((r) => [r.key, r.label, r.count])).toEqual([
      ['station', 'Station', null],
      ['co-located', 'Co-located stations', 1],
      ['selected', 'Selected station', null],
    ])
    expect(rows[0].swatch).toEqual({ fill: '#4477AA', stroke: '#ffffff', strokeWidth: 1.2 })
    expect(rows[1].badge).toEqual({ text: '2', fill: '#1a6faf', stroke: '#ffffff', color: '#ffffff' })
    expect(rows[2].swatch.stroke).toBe('#5aaee8')
  })

  it('drops the co-located row when no site holds two visible stations', () => {
    const rows = legendRows(drawn(null, new Set(['aceabsar', 'bozmtest'])), 'light', getVar('light'))
    expect(rows.map((r) => r.key)).toEqual(['station', 'selected'])
    expect(rows[0].swatch.stroke).toBe('#2a2a3a')
  })
})
