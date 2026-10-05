import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import placesText from '../../../public/data/places.json?raw'
import stationsCsv from '../ag/__fixtures__/stations.csv?raw'
import type { Station } from '../api'
import { filterItems } from '../controls/comboboxModel'
import { parseCsv } from '../csv'
import { stationItems } from '../latest'
import { NETWORK_OPTIONS } from '../url-schema'
import {
  type AreaGeometry,
  isPlaceItem,
  loadReservationAreas,
  parsePlaces,
  PLACE_RESULTS,
  placeAnnouncement,
  placeIdOf,
  placeItems,
  pointInGeometry,
  stationsForPlace,
  type Place,
  type PlacesJson,
} from '.'

const places = parsePlaces(JSON.parse(placesText) as PlacesJson)
const byName = (name: string, kind?: Place['kind']) => places.find((p) => p.name === name && (!kind || p.kind === kind))!
const stations = parseCsv<Record<string, unknown>>(stationsCsv) as unknown as Station[]
const reservationsGeo = readFileSync('public/geo/mt_reservations_simple.geojson', 'utf8')

describe('places.json (Census Gazetteer, Montana)', () => {
  it('has every county and reservation, the towns and the ZIP codes, each inside Montana', () => {
    const count = (k: Place['kind']) => places.filter((p) => p.kind === k).length
    expect(count('county')).toBe(56)
    expect(count('reservation')).toBe(7)
    expect(count('tribe')).toBe(1)
    expect(count('zip')).toBeGreaterThan(300)
    expect(count('city') + count('town') + count('community')).toBeGreaterThan(450)
    for (const p of places) {
      expect(p.lat, p.name).toBeGreaterThan(44.3)
      expect(p.lat, p.name).toBeLessThan(49.1)
      expect(p.lon, p.name).toBeGreaterThan(-116.1)
      expect(p.lon, p.name).toBeLessThan(-104)
    }
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length)
  })
  it('names places the way people search them', () => {
    expect(byName('Butte').keywords).toContain('Butte-Silver Bow')
    expect(byName('Anaconda').kind).toBe('city')
    expect(byName('Bozeman').kind).toBe('city')
    expect(byName('Gallatin County').keywords).toEqual(['Gallatin'])
    expect(byName('Flathead Reservation').keywords).toContain('Salish')
    expect(places.some((p) => / (city|town|CDP)$/.test(p.name))).toBe(false)
  })
  it('every county matches the catalog’s county names; every reservation has a boundary', async () => {
    const counties = new Set(places.filter((p) => p.kind === 'county').map((p) => p.keywords[0]))
    for (const s of stations) expect(counties.has(s.county!), s.county!).toBe(true)
    const areas = await loadReservationAreas({ fetchImpl: async () => new Response(reservationsGeo, { headers: { 'content-type': 'application/geo+json' } }), vendoredBase: 'x/data/' })
    for (const p of places.filter((p) => p.kind === 'reservation')) expect(areas.has(p.id), p.name).toBe(true)
  })
})

describe('place search items', () => {
  const items = [...stationItems(stations, [...NETWORK_OPTIONS], null), ...placeItems(places)]
  const search = (q: string) => filterItems(items, q, 200, { Places: PLACE_RESULTS })
  const top = (q: string) => {
    const r = search(q)
    return r.flat[r.best]
  }
  it('place items are query-only, in the Places section, with the kind as meta', () => {
    const it0 = placeItems([byName('59715', 'zip')])[0]
    expect(it0).toMatchObject({ id: 'place:z59715', label: '59715', meta: 'ZIP code', section: 'Places', queryOnly: true })
    expect(isPlaceItem(it0.id) && placeIdOf(it0.id)).toBe('z59715')
    expect(isPlaceItem('acebozem')).toBe(false)
    expect(search('').flat.every((i) => !isPlaceItem(i.id))).toBe(true)
  })
  it.each([
    ['59715', '59715', 'ZIP code'],
    ['gallatin', 'Gallatin County', 'County'],
    ['salish', 'Flathead Reservation', 'Reservation'],
    ['rocky boys', 'Rocky Boy’s Reservation', 'Reservation'],
    ['billings', 'Billings', 'City'],
    ['lame deer', 'Lame Deer', 'Community'],
    ['little shell', 'Little Shell Tribe', 'Tribe · Great Falls'],
    ['metis', 'Little Shell Tribe', 'Tribe · Great Falls'],
  ] as const)('"%s" → %s (%s)', (q, label, meta) => {
    expect(top(q)).toMatchObject({ label, meta })
  })
  it('typos find stations and places alike (a tie goes to the station)', () => {
    const r = search('billigns')
    expect(r.flat[r.best].label).toMatch(/^Billings/)
    expect(r.groups.find((g) => g.name === 'Places')!.items.map((i) => i.label)).toContain('Billings')
    expect(search('misoula').flat.map((i) => i.label)).toContain('Missoula')
  })
  it('a station name still leads its own search; the town is listed under it', () => {
    const r = search('bozeman')
    expect(r.flat[r.best].id).toBe('acebozem')
    expect(r.groups.map((g) => g.name)).toEqual(['Stations', 'Places'])
    expect(r.groups[1].items.map((i) => i.label)).toContain('Bozeman')
  })
  it('numbers never match by typo (no 59071 for "5971")', () => {
    expect(search('5971').flat.map((i) => i.label).every((l) => l.startsWith('5971'))).toBe(true)
  })
  it('caps places at PLACE_RESULTS', () => {
    expect(search('59').flat.filter((i) => isPlaceItem(i.id)).length).toBe(PLACE_RESULTS)
  })
})

describe('pointInGeometry', () => {
  // A 10×10 square with a 2×2 hole.
  const g: AreaGeometry = {
    type: 'Polygon',
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ],
  }
  it.each([
    [1, 1, true],
    [5, 5, false], // in the hole
    [11, 5, false],
    [9.9, 9.9, true],
  ] as const)('(%s, %s) → %s', (x, y, inside) => expect(pointInGeometry(x, y, g)).toBe(inside))
  it('MultiPolygon: inside any part', () => {
    const m: AreaGeometry = { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]]] }
    expect(pointInGeometry(5.5, 5.5, m)).toBe(true)
    expect(pointInGeometry(3, 3, m)).toBe(false)
  })
})

describe('stationsForPlace', () => {
  const areas = new Map(
    (JSON.parse(reservationsGeo) as { features: { properties: { GEOID: string }; geometry: AreaGeometry }[] }).features.map((f) => [
      `r${f.properties.GEOID.replace(/R$/, '')}`,
      f.geometry,
    ]),
  )
  it('a county lists every catalog station in it, nearest its centre first', () => {
    const county = byName('Gallatin County')
    const r = stationsForPlace(county, stations)
    const expected = stations.filter((s) => s.county === 'Gallatin').map((s) => s.station)
    expect(r).toMatchObject({ title: 'Gallatin County', inside: true })
    expect(r.rows.map((x) => x.station).sort()).toEqual(expected.sort())
    expect(r.rows.map((x) => x.km)).toEqual([...r.rows.map((x) => x.km)].sort((a, b) => a - b))
    expect(placeAnnouncement(county, r)).toBe(`${expected.length} stations in Gallatin County`)
  })
  it('a reservation lists the stations inside its boundary', () => {
    const flathead = byName('Flathead Reservation')
    const r = stationsForPlace(flathead, stations, areas.get(flathead.id))
    expect(r.inside).toBe(true)
    expect(r.rows.length).toBeGreaterThan(0)
    for (const row of r.rows) {
      const s = stations.find((x) => x.station === row.station)!
      expect(['Lake', 'Sanders', 'Missoula', 'Flathead']).toContain(s.county)
    }
    expect(placeAnnouncement(flathead, r)).toMatch(/^\d+ stations? on the Flathead Reservation$/)
  })
  it('a town or ZIP code lists the 5 nearest', () => {
    const r = stationsForPlace(byName('Bozeman', 'city'), stations)
    expect(r).toMatchObject({ title: 'Near Bozeman', inside: false })
    expect(r.rows).toHaveLength(5)
    expect(r.rows[0].miles).toBeLessThan(10)
    expect(stationsForPlace(byName('59715', 'zip'), stations).title).toBe('Near 59715')
  })
  it('a tribe with no reservation lists the 5 nearest its town (Little Shell → Great Falls)', () => {
    const tribe = byName('Little Shell Tribe')
    const greatFalls = byName('Great Falls', 'city')
    const r = stationsForPlace(tribe, stations)
    expect(r).toMatchObject({ title: 'Near Great Falls', inside: false })
    expect(r.rows).toEqual(stationsForPlace(greatFalls, stations).rows)
    expect(placeAnnouncement(tribe, r)).toBe('5 stations near Great Falls')
  })
  it('an area with no station inside (or no boundary) falls back to the nearest', () => {
    const empty = stationsForPlace(byName('Gallatin County'), stations.filter((s) => s.county !== 'Gallatin'))
    expect(empty).toMatchObject({ title: 'Near Gallatin County', inside: false })
    expect(empty.rows).toHaveLength(5)
    const noArea = stationsForPlace(byName('Crow Reservation'), stations)
    expect(noArea.inside).toBe(false)
    expect(placeAnnouncement(byName('Crow Reservation'), noArea)).toBe('5 stations near Crow Reservation')
  })
})
