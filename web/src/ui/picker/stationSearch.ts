/**
 * The station search shared by the picker and the no-station landing (partials/picker/search.html):
 * the kit's place search (`MCO.places.initPlaceSearch`, on `MCO.initSearchBox`; mco-web-style 0.16.0).
 * Stations, and places while typing: a picked county, reservation, town or ZIP code lists its stations
 * below, where Near me does. The kit owns the ranking, the gazetteer (loaded from the pinned tag on the
 * first focus), the listbox and its announcements. Spread into a component that has `choose(id)`:
 *   return component({ ...stationSearch(), choose(id) { … }, searchPlaceholder() { … } })
 * and whose destroy() calls `searchDestroy()`.
 *
 * Kept from the dashboard's own combobox, around the kit's box: the × (clears the text, keeps focus,
 * shows the full list), a click on the field toggling the list, leaving the search emptying it, and the
 * Esc order (clear the text, then close the list, then let the picker close). The kit's own Esc order is
 * close-and-restore, then clear (HOUSE-STYLE §3); see DIVERGENCES.md.
 */
import Alpine from 'alpinejs'
import { stationItems } from '../../core/latest'
import type { NearStation, PlaceSearch } from '../../types/mco-places'
import { announce } from '../shell/live'

/** The list under the search: Near me, or a picked place's stations (`title` heads it). */
export type Near = {
  status: 'idle' | 'locating' | 'finding' | 'ready' | 'denied' | 'error'
  title: string
  rows: { station: string; name: string; dist: string }[]
}
const nearRows = (rows: NearStation[]) => rows.map((r) => ({ station: r.station, name: r.name, dist: MCO.places.formatMiles(r.miles) }))

/** What the search's methods read on the component they are spread into. */
interface SearchHost {
  near: Near
  /** The field's text, mirrored for the × (the kit owns the input). */
  query: string
  /** The host component's pick: select station `id`. */
  choose(id: string): void
  /** The result list opened or closed. */
  searchList(open: boolean): void
  clearSearch(): void
  $watch(expr: string, fn: () => void): void
}

export function stationSearch() {
  let ps: PlaceSearch | null = null
  let input: HTMLInputElement | null = null
  let cleanups: (() => void)[] = []
  // A later pick (a place, Near me) supersedes an earlier one still in flight.
  let gen = 0
  const isOpen = () => input?.getAttribute('aria-expanded') === 'true'
  return {
    near: { status: 'idle', title: 'Near me', rows: [] } as Near,
    query: '',
    geoSupported: MCO.places.canLocate(),

    /** x-init (after a tick, once the bindings are on) of the search wrapper: mount the kit's place search. */
    searchInit(this: SearchHost, root: HTMLElement): void {
      const field = root.querySelector<HTMLInputElement>('input')!
      const listbox = root.querySelector<HTMLElement>('[data-search-list]')!
      input = field
      const sync = () => {
        this.query = field.value
      }
      ps = MCO.places.initPlaceSearch({
        input: field,
        listbox,
        label: 'Search stations and places',
        // The network beside each station, as in Recent (the box shows the id otherwise).
        items: () => {
          const st = Alpine.store('station')
          return stationItems(st.list, Alpine.store('url').state.nets, st.id).map((s) => ({ ...s, meta: s.group }))
        },
        stations: () => Alpine.store('station').list,
        value: () => Alpine.store('station').id,
        onSelect: (id) => {
          sync()
          this.choose(id)
        },
        onPlace: (place, r) => {
          sync()
          gen++
          this.near = r ? { status: 'ready', title: r.title, rows: nearRows(r.rows) } : { status: 'finding', title: place.name, rows: [] }
        },
        // The map's copy of the kit's boundaries (public/geo), in the HTTP cache once the map has drawn.
        areas: { url: `${import.meta.env.BASE_URL}geo/mt_reservations_simple.geojson` },
      })

      // Esc with text: clear it and show the full list, before the kit's handler (which would close).
      const onEsc = (e: KeyboardEvent) => {
        if (e.key !== 'Escape' || field.value === '') return
        e.preventDefault()
        e.stopImmediatePropagation()
        this.clearSearch()
      }
      // A click on the field toggles the list; closing it empties the field.
      const onClick = () => {
        if (!isOpen()) return ps?.open()
        field.value = ''
        sync()
        ps?.close()
      }
      // Leaving the search (not for its own × or Near me) closes the list and empties the field.
      const onFocusOut = (e: FocusEvent) => {
        if (root.contains(e.relatedTarget as Node | null)) return
        field.value = ''
        sync()
        ps?.close()
      }
      field.addEventListener('keydown', onEsc, true)
      field.addEventListener('click', onClick)
      field.addEventListener('input', sync)
      field.addEventListener('keyup', sync)
      listbox.addEventListener('click', sync)
      root.addEventListener('focusout', onFocusOut)
      const observer = new MutationObserver(() => this.searchList(isOpen()))
      observer.observe(field, { attributes: true, attributeFilter: ['aria-expanded'] })
      // The catalog changed while the list is open (it loaded): re-filter.
      this.$watch('$store.station.list', () => ps?.refresh())
      cleanups = [
        () => field.removeEventListener('keydown', onEsc, true),
        () => field.removeEventListener('click', onClick),
        () => field.removeEventListener('input', sync),
        () => field.removeEventListener('keyup', sync),
        () => listbox.removeEventListener('click', sync),
        () => root.removeEventListener('focusout', onFocusOut),
        () => observer.disconnect(),
      ]
    },
    searchDestroy(): void {
      cleanups.forEach((f) => f())
      cleanups = []
      ps?.destroy()
      ps = null
      input = null
    },
    /** The search's result list opened or closed (the picker's sheet overrides this). */
    searchList(open: boolean): void {
      void open
    },
    /** ×, or Esc with text: empty the field, keep focus, show the full list. */
    clearSearch(this: SearchHost): void {
      if (!input || !ps) return
      input.value = ''
      this.query = ''
      ps.close()
      ps.open()
    },

    /* Near me: geolocation only on this tap; denied → a message, never a retry loop. */
    locate(this: SearchHost): void {
      if (!MCO.places.canLocate()) return
      // The chip closes the result list and empties the field, as a pick does.
      ps?.cancel()
      ps?.close()
      if (input) input.value = ''
      this.query = ''
      const mine = ++gen
      this.near = { status: 'locating', title: 'Near me', rows: [] }
      MCO.places.nearMe(Alpine.store('station').list).then(
        (r) => {
          if (mine !== gen) return
          this.near = { status: 'ready', title: 'Near me', rows: nearRows(r.rows) }
          announce(MCO.places.announcement(null, r))
        },
        (err: { reason?: string }) => {
          if (mine !== gen) return
          this.near = { status: err.reason === 'denied' ? 'denied' : 'error', title: 'Near me', rows: [] }
        },
      )
    },
  }
}
