/**
 * Place search for the station picker: Montana counties, reservations, towns
 * and ZIP codes from the Census Gazetteer (`public/data/places.json`, written
 * by vendor-places.mjs), as combobox items, and the stations a picked place
 * lists. Counties and reservations list every station inside them, nearest
 * their centre first (counties by the catalog's `county`, reservations by
 * their boundary in `public/geo/`); towns and ZIP codes, or an area with no
 * station inside, the 5 stations nearest their Census internal point; a
 * tribe with no reservation, the 5 nearest the town it is listed at. Pure
 * apart from the two loaders.
 */
import type { StaticDeps } from '../ag/data/staticSource'
import { getJson, vendoredBase } from '../ag/data/staticSource'
import type { Station } from '../api'
import type { ComboboxItem } from '../controls/comboboxModel'
import { haversineKm, nearestStations, type NearStation } from '../stations/nearest'

export type PlaceKind = 'county' | 'reservation' | 'tribe' | 'city' | 'town' | 'community' | 'zip'

export interface Place {
  /** c/r/p/z + Census GEOID, e.g. "c30031", "r1110", "p3008950", "z59715"; t + a slug for a hand-added tribe ("tlittleshell"). */
  id: string
  kind: PlaceKind
  name: string
  lat: number
  lon: number
  keywords: string[]
  /** A tribe with no Census reservation: the town it lists stations near (its point is the town's). */
  at?: string
}

/** Shape of `public/data/places.json`. */
export interface PlacesJson {
  source: string
  release: string
  columns: string[]
  rows: [string, PlaceKind, string, number, number, string[]?, string?][]
}

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  county: 'County',
  reservation: 'Reservation',
  tribe: 'Tribe',
  city: 'City',
  town: 'Town',
  community: 'Community',
  zip: 'ZIP code',
}

/** Combobox ids of places carry this prefix; station ids never do. */
export const PLACE_ID_PREFIX = 'place:'
export const isPlaceItem = (id: string): boolean => id.startsWith(PLACE_ID_PREFIX)
export const placeIdOf = (itemId: string): string => itemId.slice(PLACE_ID_PREFIX.length)

/** At most this many places show under the stations while typing. */
export const PLACE_RESULTS = 8

export function parsePlaces(j: PlacesJson): Place[] {
  if (!j || !Array.isArray(j.rows)) throw new Error('places.json: unexpected shape')
  return j.rows.map(([id, kind, name, lat, lon, keywords, at]) => ({ id, kind, name, lat, lon, keywords: keywords ?? [], ...(at ? { at } : {}) }))
}

export async function loadPlaces(deps?: StaticDeps): Promise<Place[]> {
  return parsePlaces(await getJson<PlacesJson>(`${vendoredBase(deps)}places.json`, deps))
}

/** Search items for the places: only while typing, in the "Places" section, the kind (and a tribe's town) beside the name. */
export function placeItems(places: readonly Place[]): ComboboxItem[] {
  return places.map((p) => ({
    id: `${PLACE_ID_PREFIX}${p.id}`,
    label: p.name,
    meta: p.at ? `${PLACE_KIND_LABELS[p.kind]} · ${p.at}` : PLACE_KIND_LABELS[p.kind],
    section: 'Places',
    queryOnly: true,
    keywords: p.keywords,
  }))
}

/* ------------------------------------------------------------ geometry */

type Ring = [number, number][]
export type AreaGeometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }

/** Even-odd ray casting over every ring (outer rings and holes alike), lon/lat. */
export function pointInGeometry(lon: number, lat: number, g: AreaGeometry): boolean {
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  let inside = false
  for (const ring of polygons.flat()) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

interface BoundaryCollection {
  features: { properties: { GEOID: string }; geometry: AreaGeometry }[]
}

/** The map's reservation boundaries (`public/geo/`, the mco-web-style copy), keyed by place id ("r1110"). */
export async function loadReservationAreas(deps?: StaticDeps): Promise<Map<string, AreaGeometry>> {
  const base = deps?.vendoredBase ? deps.vendoredBase.replace(/data\/$/, 'geo/') : `${(import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/')}geo/`
  const fc = await getJson<BoundaryCollection>(`${base}mt_reservations_simple.geojson`, deps)
  return new Map(fc.features.map((f) => [`r${f.properties.GEOID.replace(/R$/, '')}`, f.geometry]))
}

/* -------------------------------------------------------------- stations */

export interface PlaceStations {
  /** Section heading: "Gallatin County", "Near Bozeman", "Near 59715", "Near Great Falls" (Little Shell Tribe). */
  title: string
  /** True when these are the stations inside the area (else the nearest). */
  inside: boolean
  rows: NearStation[]
}

const KM_PER_MI = 1.609344
type StationRow = Pick<Station, 'station' | 'name' | 'sub_network' | 'latitude' | 'longitude' | 'county'>

/**
 * The stations to list for a picked place. `area` is the reservation's
 * boundary (counties use `county`; other kinds ignore it). Every list is
 * sorted by distance from the place's point; an area with no station inside
 * falls back to the 5 nearest.
 */
export function stationsForPlace(place: Place, list: readonly StationRow[], area?: AreaGeometry): PlaceStations {
  const ok = list.filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
  let inside: StationRow[] | null = null
  if (place.kind === 'county') {
    const county = place.name.replace(/ County$/, '').toLowerCase()
    inside = ok.filter((s) => (s.county ?? '').toLowerCase() === county)
  } else if (place.kind === 'reservation' && area) {
    inside = ok.filter((s) => pointInGeometry(s.longitude, s.latitude, area))
  }
  if (inside && inside.length > 0) {
    const rows = inside
      .map((s) => {
        const km = haversineKm(place.lat, place.lon, s.latitude, s.longitude)
        return { station: s.station, name: s.name, sub_network: s.sub_network, km, miles: km / KM_PER_MI }
      })
      .sort((a, b) => a.km - b.km)
    return { title: place.name, inside: true, rows }
  }
  return { title: `Near ${place.at ?? place.name}`, inside: false, rows: nearestStations(ok, place.lat, place.lon) }
}

/** Polite announcement for a place's list: "12 stations in Gallatin County", "3 stations on the Flathead Reservation", "5 stations near Bozeman". */
export function placeAnnouncement(place: Place, r: PlaceStations): string {
  const n = r.rows.length
  const where = !r.inside ? `near ${place.at ?? place.name}` : place.kind === 'reservation' ? `on the ${place.name}` : `in ${place.name}`
  return `${n} ${n === 1 ? 'station' : 'stations'} ${where}`
}
