/**
 * The station search shared by the picker and the no-station landing (partials/picker/search.html):
 * stations, and places while typing (a picked county, reservation, town or ZIP code lists its
 * stations below, where Near me does). Spread into a component that has `choose(id)`:
 *   return component({ ...stationSearch(), choose(id) { … }, searchPlaceholder() { … } })
 */
import Alpine from 'alpinejs'
import type { ComboboxItem } from '../../core/controls/comboboxModel'
import { stationItems } from '../../core/latest'
import {
  type AreaGeometry,
  isPlaceItem,
  loadPlaces,
  loadReservationAreas,
  PLACE_RESULTS,
  placeAnnouncement,
  placeIdOf,
  placeItems,
  stationsForPlace,
  type Place,
} from '../../core/places'
import { formatMiles, nearestStations, type NearStation } from '../../core/stations/nearest'
import { announce } from '../shell/live'

/** The list under the search: Near me, or a picked place's stations (`title` heads it). */
export type Near = {
  status: 'idle' | 'locating' | 'finding' | 'ready' | 'denied' | 'error'
  title: string
  rows: { station: string; name: string; dist: string }[]
}
const nearRows = (rows: NearStation[]) => rows.map((r) => ({ station: r.station, name: r.name, dist: formatMiles(r.miles) }))
/** Combobox section caps: a handful of places under the stations. */
export const SEARCH_SECTION_LIMITS = { Places: PLACE_RESULTS }

/** What the search's methods read on the component they are spread into. */
interface SearchHost {
  near: Near
  placesWanted: boolean
  places(): Place[] | null
  choosePlace(placeId: string): Promise<void>
  /** The host component's pick: select station `id`. */
  choose(id: string): void
}

export function stationSearch() {
  // Reservation boundaries load on the first reservation pick; a later pick supersedes an earlier one.
  let areas: Promise<Map<string, AreaGeometry>> | null = null
  let pickGen = 0
  // placeItems for the loaded places, built once.
  let placeCache: { places: Place[]; items: ComboboxItem[] } | null = null
  return {
    near: { status: 'idle', title: 'Near me', rows: [] } as Near,
    /** Places load the first time the search list opens (15 KB gzipped). */
    placesWanted: false,
    searchLimits: SEARCH_SECTION_LIMITS,
    geoSupported: typeof navigator !== 'undefined' && 'geolocation' in navigator,

    items(this: SearchHost): ComboboxItem[] {
      const st = Alpine.store('station')
      // The network beside each station, as in Recent (the combobox shows the id otherwise).
      const stations = stationItems(st.list, Alpine.store('url').state.nets, st.id).map((s) => ({ ...s, meta: s.group }))
      const places = this.places()
      if (!places) return stations
      if (placeCache?.places !== places) placeCache = { places, items: placeItems(places) }
      return [...stations, ...placeCache.items]
    },
    /** The loaded places, or null (not asked for yet, loading, or failed: the search still finds stations). */
    places(this: SearchHost): Place[] | null {
      if (!this.placesWanted) return null
      const res = Alpine.store('data').cached('places', () => loadPlaces(), { ttl: Infinity })
      return res.data ? Alpine.raw(res.data) : null
    },
    /** A search pick: a station is chosen; a place lists its stations below. */
    pick(this: SearchHost, id: string): void {
      if (isPlaceItem(id)) void this.choosePlace(placeIdOf(id))
      else this.choose(id)
    },
    async choosePlace(this: SearchHost, placeId: string): Promise<void> {
      const place = this.places()?.find((p) => p.id === placeId)
      if (!place) return
      const gen = ++pickGen
      let area: AreaGeometry | undefined
      if (place.kind === 'reservation') {
        this.near = { status: 'finding', title: place.name, rows: [] }
        areas ??= loadReservationAreas()
        // Without the boundary, the stations nearest the reservation's point.
        area = await areas.then((m) => m.get(place.id)).catch(() => {
          areas = null
          return undefined
        })
        if (gen !== pickGen) return
      }
      const r = stationsForPlace(place, Alpine.store('station').list, area)
      this.near = { status: 'ready', title: r.title, rows: nearRows(r.rows) }
      announce(placeAnnouncement(place, r))
    },

    /* Near me: geolocation only on this tap; denied → a message, never a retry loop. */
    locate(this: SearchHost): void {
      if (!('geolocation' in navigator)) return
      const gen = ++pickGen
      this.near = { status: 'locating', title: 'Near me', rows: [] }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (gen !== pickGen) return
          const rows = nearestStations(Alpine.store('station').list, pos.coords.latitude, pos.coords.longitude)
          this.near = { status: 'ready', title: 'Near me', rows: nearRows(rows) }
          announce(`${rows.length} stations near you`)
        },
        (err) => {
          if (gen !== pickGen) return
          this.near = { status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error', title: 'Near me', rows: [] }
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
      )
    },
  }
}
