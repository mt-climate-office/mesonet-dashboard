/**
 * Types for `MCO.places` (mco-web-style places/mco-places.js, pinned in index.html after core) and the
 * kit's search box it rides on (`MCO.initSearchBox`, `MCO.searchModel`, core).
 * Hand-written from the modules' source comments (0.16.0); only what the dashboard calls, plus the shapes it reads.
 * The kit ships no types: when the pin moves, re-read the modules and update these.
 */

/** One row of the kit's search: a station, or a place (`place:` id prefix). */
export interface SearchItem {
  id: string
  label: string
  /** Heading for the no-query list (the network). */
  group?: string
  /** Extra codes matched like the id (the NWSLI id; a place's other names). */
  keywords?: string[]
  /** Text beside the label (default: the id). */
  meta?: string
  /** Results section while typing ("Stations", "Places"); headed when more than one matches (0.16.0). */
  section?: string
  /** Listed only for a query, never in the full list (0.16.0). */
  queryOnly?: boolean
}

export interface SearchResult {
  groups: { name: string | null; items: SearchItem[] }[]
  flat: SearchItem[]
  total: number
  best: number
}

export interface SearchModel {
  filter(items: readonly SearchItem[], query: string, limit?: number, sectionLimits?: Readonly<Record<string, number>>): SearchResult
  summary(shown: number, total: number): string
}

export interface SearchBoxOptions {
  input: HTMLInputElement
  listbox: HTMLElement
  items: SearchItem[] | (() => SearchItem[])
  onSelect?: (id: string) => void
  /** The current item, marked ✓. */
  value?: () => string | null
  /** Names the listbox when it has no aria-label(ledby). */
  label?: string
  limit?: number
  announce?: boolean
  fillOnSelect?: boolean
  sectionLimits?: Readonly<Record<string, number>>
  /** Fill an option's element (textContent only); the default is the label and a mono meta. */
  renderRow?: (item: SearchItem, el: HTMLElement) => void
}

export interface SearchBox {
  /** Focus the field and open the list (on the current item). */
  open(): void
  close(): void
  /** Items changed while open: re-filter. */
  refresh(): void
  destroy(): void
}

export type PlaceKind = 'county' | 'reservation' | 'tribe' | 'city' | 'town' | 'community' | 'zip'

export interface Place {
  /** c/r/p/z + Census GEOID ("c30031", "r1110", "p3008950", "z59715"); t + a slug for a hand-added tribe. */
  id: string
  kind: PlaceKind
  name: string
  lat: number
  lon: number
  keywords: string[]
  /** A tribe with no Census reservation: the town it lists stations near. */
  at?: string
}

/** A station in a place's or Near me's list. */
export interface NearStation {
  station: string
  name: string
  sub_network: string
  km: number
  miles: number
}

export interface PlaceStations {
  /** "Gallatin County", "Near Bozeman", "Near 59715", "Near Great Falls" (Little Shell Tribe), "Near me". */
  title: string
  /** The stations inside the area (else the nearest). */
  inside: boolean
  rows: NearStation[]
}

/** The /stations/ fields the module reads. */
export interface PlaceStationRow {
  station: string
  name: string
  sub_network: string
  latitude: number
  longitude: number
  county?: string | null
}

export type LocateReason = 'unsupported' | 'denied' | 'unavailable' | 'timeout'

export interface PlaceSearchOptions extends Omit<SearchBoxOptions, 'items' | 'onSelect'> {
  /** The app's own items (stations); those without a section are put in "Stations". */
  items: () => SearchItem[]
  /** Rows for distances and county / boundary membership. */
  stations: () => readonly PlaceStationRow[]
  /** A station (any non-place item) was picked. */
  onSelect?: (id: string) => void
  /** A place was picked: `result` null while a reservation's boundary loads, then its stations. */
  onPlace?: (place: Place, result: PlaceStations | null) => void
  onError?: (err: Error) => void
  /** Where the gazetteer comes from (default: the kit's own tag). */
  load?: { url?: string; integrity?: string; base?: string }
  /** Where the reservation boundaries come from (default: the kit's map/data at its tag); false skips them. */
  areas?: false | { url?: string; integrity?: string; base?: string }
}

export interface PlaceSearch extends SearchBox {
  places(): Place[] | null
  pick(placeId: string): Promise<PlaceStations | null>
  /** Drop a reservation pick still waiting on its boundary. */
  cancel(): void
}

export interface McoPlaces {
  KINDS: Readonly<Record<PlaceKind, string>>
  ID_PREFIX: string
  RESULTS: number
  NEAREST: number
  KM_PER_MI: number
  /** The hashes the module fetches its gazetteer and the reservation boundaries with. */
  DATA_INTEGRITY: string
  AREAS_INTEGRITY: string
  isPlaceItem(id: string): boolean
  placeIdOf(itemId: string): string
  items(places: readonly Place[]): SearchItem[]
  haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number
  nearest(point: { lat: number; lon: number }, stations: readonly PlaceStationRow[], n?: number): NearStation[]
  /** "0.4 mi" under 10 miles, else "23 mi". */
  formatMiles(mi: number): string
  /** Reservation boundaries (a FeatureCollection with GEOIDs) keyed by place id ("r1110"). */
  areaIndex(fc: unknown): Map<string, unknown>
  parse(json: unknown): Place[]
  stationsFor(place: Place, stations: readonly PlaceStationRow[], area?: unknown): PlaceStations
  /** "12 stations in Gallatin County"; with no place, "5 stations near you". */
  announcement(place: Place | null, result: PlaceStations): string
  canLocate(): boolean
  /** Rejects an Error with `reason` (LocateReason). Call only on a button press. */
  nearMe(stations: readonly PlaceStationRow[], opts?: { n?: number; timeoutMs?: number; maximumAge?: number }): Promise<PlaceStations & { point: { lat: number; lon: number; accuracy: number } }>
  initPlaceSearch(opts: PlaceSearchOptions): PlaceSearch
}
