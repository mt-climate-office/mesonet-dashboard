/**
 * The station search's places, as the dashboard uses them: its station items (core/latest `stationItems`)
 * searched with the kit's places (MCO.places, mco-web-style 0.16.0, the pinned file on the test global)
 * under the kit's ranking, and a picked place's stations. The kit's own suite (tools/check-places.mjs)
 * covers the module; these pin what the dashboard relies on, on its own catalog fixture and its own
 * copy of the reservation boundaries (public/geo, which the search loads them from).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { kitData } from '../../../test/kit'
import stationsCsv from '../ag/__fixtures__/stations.csv?raw'
import type { Station } from '../api'
import { parseCsv } from '../csv'
import { stationItems } from '../latest'
import { NETWORK_OPTIONS } from '../url-schema'
import type { Place } from '../../types/mco-places'

const P = MCO.places
const places = P.parse(JSON.parse(kitData('places/mt-places.json')))
const byName = (name: string, kind?: Place['kind']) => places.find((p) => p.name === name && (!kind || p.kind === kind))!
const stations = parseCsv<Record<string, unknown>>(stationsCsv) as unknown as Station[]
const reservationsGeo = readFileSync('public/geo/mt_reservations_simple.geojson')
const areas = P.areaIndex(JSON.parse(reservationsGeo.toString('utf8')))

// What stationSearch.ts hands initPlaceSearch: the station items (network as meta), then the places.
const items = [...stationItems(stations, [...NETWORK_OPTIONS], null).map((s) => ({ ...s, meta: s.group })), ...P.items(places)]
const search = (q: string) => MCO.searchModel.filter(items, q, 200, { Places: P.RESULTS })
const top = (q: string) => {
  const r = search(q)
  return r.flat[r.best]
}

describe('the gazetteer and the catalog', () => {
  it('every catalog county is a place; every reservation has a boundary in public/geo', () => {
    const counties = new Set(places.filter((p) => p.kind === 'county').map((p) => p.keywords[0]))
    for (const s of stations) expect(counties.has(s.county!), s.county!).toBe(true)
    for (const p of places.filter((x) => x.kind === 'reservation')) expect(areas.has(p.id), p.name).toBe(true)
  })
  it('public/geo holds the kit’s boundaries, byte for byte', () => {
    expect(`sha384-${createHash('sha384').update(reservationsGeo).digest('base64')}`).toBe(P.AREAS_INTEGRITY)
  })
})

describe('station search with places', () => {
  it('places are listed only while typing', () => {
    expect(search('').flat.every((i) => !P.isPlaceItem(i.id))).toBe(true)
  })
  it.each([
    ['59715', '59715', 'ZIP code'],
    ['gallatin', 'Gallatin County', 'County'],
    ['salish', 'Flathead Reservation', 'Reservation'],
    ['rocky boys', 'Rocky Boy’s Reservation', 'Reservation'],
    ['billings', 'Billings', 'City'],
    ['little shell', 'Little Shell Tribe', 'Tribe · Great Falls'],
  ] as const)('"%s" → %s (%s)', (q, label, meta) => {
    expect(top(q)).toMatchObject({ label, meta })
  })
  it('a station name still leads its own search; the town is listed under it, each headed', () => {
    const r = search('bozeman')
    expect(r.flat[r.best].id).toBe('acebozem')
    expect(r.groups.map((g) => g.name)).toEqual(['Stations', 'Places'])
    expect(r.groups[1].items.map((i) => i.label)).toContain('Bozeman')
    expect(r.flat[r.best].meta).toBe('HydroMet')
  })
  it('typos find stations and places; numbers never match by typo; places capped at 8', () => {
    expect(search('misoula').flat.map((i) => i.label)).toContain('Missoula')
    expect(search('5971').flat.map((i) => i.label).every((l) => l.startsWith('5971'))).toBe(true)
    expect(search('59').flat.filter((i) => P.isPlaceItem(i.id)).length).toBe(8)
  })
})

describe('a picked place lists stations', () => {
  it('a county: every catalog station in it, nearest its centre first', () => {
    const county = byName('Gallatin County')
    const r = P.stationsFor(county, stations)
    const expected = stations.filter((s) => s.county === 'Gallatin').map((s) => s.station)
    expect(r).toMatchObject({ title: 'Gallatin County', inside: true })
    expect(r.rows.map((x) => x.station).sort()).toEqual(expected.sort())
    expect(P.announcement(county, r)).toBe(`${expected.length} stations in Gallatin County`)
  })
  it('a reservation: the stations inside its boundary', () => {
    const flathead = byName('Flathead Reservation')
    const r = P.stationsFor(flathead, stations, areas.get(flathead.id))
    expect(r.inside).toBe(true)
    expect(r.rows.length).toBeGreaterThan(0)
    expect(P.announcement(flathead, r)).toMatch(/^\d+ stations? on the Flathead Reservation$/)
  })
  it('a town, a ZIP code or a tribe: the 5 nearest, with distances in miles', () => {
    const r = P.stationsFor(byName('Bozeman', 'city'), stations)
    expect(r).toMatchObject({ title: 'Near Bozeman', inside: false })
    expect(r.rows).toHaveLength(5)
    expect(P.formatMiles(r.rows[0].miles)).toMatch(/^\d+\.\d mi$/)
    expect(P.stationsFor(byName('59715', 'zip'), stations).title).toBe('Near 59715')
    expect(P.announcement(byName('Little Shell Tribe'), P.stationsFor(byName('Little Shell Tribe'), stations))).toBe('5 stations near Great Falls')
  })
})
