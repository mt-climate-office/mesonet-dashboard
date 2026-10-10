import { describe, expect, it } from 'vitest'
import type { Station } from '../api'
import { NETWORK_COLOR, type Theme } from '../palette'
import { TOKENS_SNAPSHOT } from '../palette/tokens.snapshot'
import {
  asNetwork,
  clickTarget,
  formatElevation,
  legendRows,
  markerKeyOf,
  markerStyle,
  popupLines,
  selectionAnnouncement,
  stationMarkers,
  stationRows,
  visibleStations,
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

// Bozeman pair is co-located (same lat/lon), as in the live catalog.
const CATALOG: Station[] = [
  st('acebozem', { name: 'Bozeman', longitude: -111.05, latitude: 45.66 }),
  st('bozmtest', { name: 'Bozeman AgriMet', sub_network: 'AgriMet', longitude: -111.05, latitude: 45.66 }),
  st('aceabsar', { name: 'Absarokee', longitude: -109.61, latitude: 45.56, county: 'Stillwater' }),
  st('wsrfoo', { name: 'Foo', sub_network: 'AgriMet', longitude: -108, latitude: 47, county: '' }),
  st('nocoords', { latitude: Number.NaN }),
]

// Kit v0.11.2 --dot-stroke per theme (not in the palette snapshot).
const DOT_STROKE: Record<Theme, string> = { dark: '#ffffff', light: '#2a2a3a', 'high-contrast': '#ffffff' }
const getVar = (theme: Theme) => (name: string) =>
  name === '--dot-stroke' ? DOT_STROKE[theme] : (TOKENS_SNAPSHOT[theme][name] ?? '')

const markers = (selected: string | null = null, visible: ReadonlySet<string> | null = null, theme: Theme = 'dark') =>
  stationMarkers({ stations: CATALOG, visible, selected, theme, getVar: getVar(theme) })

describe('asNetwork', () => {
  it('keeps palette networks and maps anything else to HydroMet (legacy rule)', () => {
    expect(asNetwork('AgriMet')).toBe('AgriMet')
    expect(asNetwork('Cooperator')).toBe('Cooperator')
    expect(asNetwork('Something')).toBe('HydroMet')
  })
})

describe('markerStyle', () => {
  it('gives each network shape a distinct paint', () => {
    const g = getVar('light')
    expect(markerStyle('HydroMet', 'light', g)).toEqual({ fill: '#4477AA', stroke: '#2a2a3a', strokeWidth: 1.2 })
    expect(markerStyle('AgriMet', 'light', g)).toEqual({ fill: '#ffffff', stroke: '#CC6622', strokeWidth: 2.5 })
    expect(markerStyle('Cooperator', 'light', g)).toEqual({ fill: 'rgba(0,0,0,0)', stroke: '#009988', strokeWidth: 1.5 })
  })
})

describe('stationMarkers', () => {
  it('merges co-located stations into one marker and drops rows without coordinates', () => {
    const fc = markers()
    expect(fc.features.map((f) => f.properties.key)).toEqual(['acebozem,bozmtest', 'aceabsar', 'wsrfoo'])
    const pair = fc.features[0].properties
    expect(pair.network).toBe('HydroMet')
    expect(pair.networks).toBe('HydroMet,AgriMet')
    expect(pair.halo).toBe(NETWORK_COLOR.dark.AgriMet)
    expect(fc.features[1].properties.halo).toBe('')
    expect(fc.features[0].geometry.coordinates).toEqual([-111.05, 45.66])
  })

  it('flags the selected marker and sorts it on top', () => {
    const fc = markers('bozmtest')
    expect(fc.features[0].properties.selected).toBe(1)
    expect(fc.features[0].properties.sort).toBe(3)
    expect(fc.features[1].properties).toMatchObject({ selected: 0, sort: 0 })
  })

  it('respects the visible set (network filter)', () => {
    const fc = markers('acebozem', new Set(['bozmtest', 'wsrfoo']))
    expect(fc.features.map((f) => f.properties.key)).toEqual(['bozmtest', 'wsrfoo'])
    expect(fc.features[0].properties).toMatchObject({ network: 'AgriMet', halo: '', selected: 0 })
  })

  it('re-resolves colors per theme', () => {
    const light = markers(null, null, 'light')
    expect(light.features[2].properties.stroke).toBe('#CC6622')
    expect(markers().features[2].properties.stroke).toBe('#EE7733')
  })
})

describe('clickTarget / markerKeyOf', () => {
  it('picks the first code, then cycles through a co-located marker', () => {
    expect(clickTarget('acebozem,bozmtest', null)).toBe('acebozem')
    expect(clickTarget('acebozem,bozmtest', 'aceabsar')).toBe('acebozem')
    expect(clickTarget('acebozem,bozmtest', 'acebozem')).toBe('bozmtest')
    expect(clickTarget('acebozem,bozmtest', 'bozmtest')).toBe('acebozem')
    expect(clickTarget('aceabsar', 'aceabsar')).toBe('aceabsar')
    expect(clickTarget('', null)).toBeNull()
  })
  it('finds the marker holding a station', () => {
    const fc = markers()
    expect(markerKeyOf(fc, 'bozmtest')).toBe('acebozem,bozmtest')
    expect(markerKeyOf(fc, 'nope')).toBeNull()
    expect(markerKeyOf(fc, null)).toBeNull()
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
  it('lists networks present, the co-located row with a count, and the selection ring', () => {
    const rows = legendRows(markers(), 'dark', getVar('dark'))
    expect(rows.map((r) => [r.key, r.label, r.count])).toEqual([
      ['HydroMet', 'HydroMet', null],
      ['AgriMet', 'AgriMet', null],
      ['co-located', 'Co-located stations', 1],
      ['selected', 'Selected station', null],
    ])
    expect(rows[2].halo).toBe(NETWORK_COLOR.dark.AgriMet)
    expect(rows[3].swatch.stroke).toBe('#5aaee8')
  })

  it('drops rows for networks the filter hides', () => {
    const rows = legendRows(markers(null, new Set(['aceabsar'])), 'light', getVar('light'))
    expect(rows.map((r) => r.key)).toEqual(['HydroMet', 'selected'])
  })
})
