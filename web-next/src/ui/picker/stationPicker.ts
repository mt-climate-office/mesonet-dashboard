/**
 * `x-data="stationPicker"` on `#station-picker` (partials/picker.html): the
 * station search (Near me inside it; places too: a picked county, reservation,
 * town or ZIP code lists its stations where Near me does), recents, and "Browse on the map"
 * (network chips + map, revealed on demand), presented as a
 * bottom sheet on compact viewports and a drawer elsewhere (inline at ≥ 1060
 * px, overlay between). The presentations are ui/layout/{sheet,drawer}.ts;
 * this wrapper picks one per viewport, decides when it starts open
 * (core/stations/recent `pickerStartsOpen`) and handles the picks.
 * Openers dispatch `togglePicker(button)`.
 */
import Alpine from 'alpinejs'
import type { ComboboxItem } from '../../core/controls/comboboxModel'
import { netsValue, networkOptions, stationItems } from '../../core/latest'
import { visibleStationIds } from '../../core/latest/stations'
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
import { pickerStartsOpen, readDrawerOpen, saveDrawerOpen } from '../../core/stations/recent'
import { browserStorage } from '../../stores/station'
import { initDrawer } from '../layout/drawer'
import { initSheet } from '../layout/sheet'
import { component } from '../component'
import { announce } from '../shell/live'

const EVENT = 'dash:picker'
const DESKTOP_MQ = '(min-width: 1060px)'

/** Open or close the picker from any button (it becomes the focus-return target). */
export const togglePicker = (opener: HTMLElement | null): void => void window.dispatchEvent(new CustomEvent(EVENT, { detail: { opener } }))

type Mode = 'sheet' | 'inline' | 'overlay'
type Ctl = {
  open(o?: { opener?: HTMLElement | null; focus?: boolean }): void
  close(o?: { restoreFocus?: boolean }): void
  readonly isOpen: boolean
  destroy(): void
  /** Sheet only: peek / full. */
  setState?(s: 'peek' | 'full'): void
}
/** The list under the search: Near me, or a picked place's stations (`title` heads it). */
type Near = {
  status: 'idle' | 'locating' | 'finding' | 'ready' | 'denied' | 'error'
  title: string
  rows: { station: string; name: string; dist: string }[]
}
const nearRows = (rows: NearStation[]) => rows.map((r) => ({ station: r.station, name: r.name, dist: formatMiles(r.miles) }))
/** Combobox section caps: a handful of places under the stations. */
export const SEARCH_SECTION_LIMITS = { Places: PLACE_RESULTS }

const modeNow = (): Mode => (MCO.viewport.isCompact() ? 'sheet' : matchMedia(DESKTOP_MQ).matches ? 'inline' : 'overlay')
const background = () => [...document.querySelectorAll('.mco-navbar, .dash-content, .dash-tabbar')]
const toggles = () => [...document.querySelectorAll<HTMLElement>('[data-picker-toggle]')]

export function stationPicker() {
  let ctl: Ctl | null = null
  // Reservation boundaries load on the first reservation pick; a later pick supersedes an earlier one.
  let areas: Promise<Map<string, AreaGeometry>> | null = null
  let pickGen = 0
  // placeItems for the loaded places, built once.
  let placeCache: { places: Place[]; items: ComboboxItem[] } | null = null
  const cleanups: (() => void)[] = []
  // True while the picker opens or closes by itself (first visit, bad station link, a viewport
  // rebuild): not a preference to save.
  let auto = false
  const quietly = (f: () => void) => {
    auto = true
    f()
    auto = false
  }
  const autoOpen = () => quietly(() => ctl?.open({ focus: false }))
  return component({
    open: false,
    mode: 'inline' as Mode,
    /** "Browse on the map" is open: the network chips and the map show. */
    mapShown: false,
    /** The map mounts on the first reveal and then stays (MapLibre is costly to rebuild). */
    mapMounted: false,
    /** The search's result list is open (the phone sheet gives it the whole sheet). */
    searchOpen: false,
    near: { status: 'idle', title: 'Near me', rows: [] } as Near,
    /** Places load the first time the search list opens (15 KB gzipped). */
    placesWanted: false,
    searchLimits: SEARCH_SECTION_LIMITS,
    geoSupported: typeof navigator !== 'undefined' && 'geolocation' in navigator,

    init() {
      this.build(false)
      const onEvent = (e: Event) => this.toggle((e as CustomEvent<{ opener: HTMLElement | null }>).detail?.opener ?? null)
      window.addEventListener(EVENT, onEvent)
      cleanups.push(() => window.removeEventListener(EVENT, onEvent))
      const desktop = matchMedia(DESKTOP_MQ)
      const onViewport = () => modeNow() !== this.mode && this.build(true)
      desktop.addEventListener('change', onViewport)
      cleanups.push(MCO.viewport.onChange(onViewport), () => desktop.removeEventListener('change', onViewport))
      // A link whose station turns out not to exist: open the picker once the catalog says so.
      const fx = Alpine.effect(() => {
        const st = Alpine.store('station')
        if (st.catalog?.status === 'success' && !st.id && !ctl?.isOpen) autoOpen()
      })
      cleanups.push(() => Alpine.release(fx))
    },

    /** (Re)create the presentation for the current viewport and apply the start rule. */
    build(viewportChange: boolean): void {
      quietly(() => ctl?.close({ restoreFocus: false }))
      ctl?.destroy()
      const panel = this.$el as HTMLElement
      const scrim = document.getElementById('picker-scrim')
      this.mode = modeNow()
      const onChange = (open: boolean) => {
        this.open = open
        // The phone sheet reopens on search and recents, not on the map that filled it.
        if (!open && this.mode === 'sheet') this.mapShown = false
        if (this.mode === 'inline' && !auto) saveDrawerOpen(browserStorage(), open)
      }
      if (this.mode === 'sheet') {
        panel.hidden = true
        // Queried, not $refs: child x-refs are not registered yet when init() runs.
        const handle = panel.querySelector<HTMLElement>('.dash-sheet-handle')!
        ctl = initSheet({ panel, handle, scrim, background, toggles, onChange: (o) => onChange(o) })
      } else {
        panel.hidden = false
        ctl = initDrawer({ panel, scrim, toggles, background, overlay: () => this.mode === 'overlay', onChange })
      }
      const hasStation = !!Alpine.store('url').state.s
      const start = pickerStartsOpen(hasStation, this.mode === 'inline', readDrawerOpen(browserStorage()))
      // On load nothing animates (the first frame is the final layout) or steals focus; after a
      // resize the panel may animate. Back on desktop, the saved drawer state returns.
      if (!viewportChange) panel.classList.add('no-anim')
      if (start) autoOpen()
      requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove('no-anim')))
      this.open = ctl.isOpen
    },

    get modal(): boolean {
      return this.mode !== 'inline'
    },
    /** The panel's presentation class; `map-open` / `search-open` let the sheet give the map or the results the room left. */
    panelClass(): string {
      return `${this.mode === 'sheet' ? 'dash-sheet' : 'dash-drawer'}${this.mapShown ? ' map-open' : ''}${this.searchOpen ? ' search-open' : ''}`
    },

    toggle(opener: HTMLElement | null): void {
      if (ctl?.isOpen) return ctl.close()
      ctl?.open({ opener })
      if (this.mapShown) ctl?.setState?.('full')
    },
    close(): void {
      ctl?.close()
    },

    /**
     * A station was picked here: select it and close at every size (the inline
     * drawer saves 'closed'). Focus goes to <main>, the new station's content;
     * the opener may be gone (the Now empty state's button).
     */
    choose(id: string): void {
      const st = Alpine.store('station')
      st.select(id)
      announce(`${st.byId(id)?.name ?? id} selected`)
      ctl?.close({ restoreFocus: false })
      document.getElementById('main')?.focus({ preventScroll: true })
    },

    /* Search (ui/controls/combobox): stations, then places while typing */
    items(): ComboboxItem[] {
      const st = Alpine.store('station')
      // The network beside each station, as in Recent (the combobox shows the id otherwise).
      const stations = stationItems(st.list, Alpine.store('url').state.nets, st.id).map((s) => ({ ...s, meta: s.group }))
      const places = this.places()
      if (!places) return stations
      if (placeCache?.places !== places) placeCache = { places, items: placeItems(places) }
      return [...stations, ...placeCache.items]
    },
    /** The loaded places, or null (not asked for yet, loading, or failed: the search still finds stations). */
    places(): Place[] | null {
      if (!this.placesWanted) return null
      const res = Alpine.store('data').cached('places', () => loadPlaces(), { ttl: Infinity })
      return res.data ? Alpine.raw(res.data) : null
    },
    /** The search's result list opened or closed. On a phone the sheet goes full and the list fills it. */
    searchList(open: boolean): void {
      this.searchOpen = open
      if (open) this.placesWanted = true
      if (open && this.mode === 'sheet') ctl?.setState?.('full')
    },
    /** The 336 px drawer has room beside "Near me" for the short hint only (picker.css); the sheet names counties too. */
    searchPlaceholder(): string {
      const c = Alpine.store('station').catalog
      if (c?.status === 'error') return 'Failed to load stations'
      if (!c?.data) return 'Loading stations…'
      return this.mode === 'sheet' ? 'Station, town, county or ZIP' : 'Station, town or ZIP'
    },
    /** A search pick: a station is chosen; a place lists its stations below. */
    pick(id: string): void {
      if (isPlaceItem(id)) void this.choosePlace(placeIdOf(id))
      else this.choose(id)
    },
    async choosePlace(placeId: string): Promise<void> {
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

    /* Browse on the map */
    toggleMap(): void {
      this.mapShown = !this.mapShown
      if (!this.mapShown) return
      this.mapMounted = true
      // On a phone the map needs the room: the sheet goes full and the map scrolls into view.
      ctl?.setState?.('full')
      void this.$nextTick(() => document.getElementById('picker-map-region')?.scrollIntoView({ block: 'nearest' }))
    },

    /* Networks (ui/controls/chips over ?nets=) */
    networkOptions() {
      return networkOptions(Alpine.store('station').list).map((v) => ({ value: v, label: v }))
    },
    nets(): string[] {
      return [...Alpine.store('url').state.nets]
    },
    setNets(next: string[]): void {
      Alpine.store('url').set({ nets: netsValue(next, networkOptions(Alpine.store('station').list)) })
    },
    visible(): string[] {
      const st = Alpine.store('station')
      return visibleStationIds(st.list, Alpine.store('url').state.nets, st.id)
    },

    /* Recents */
    recent(): { station: string; name: string; network: string; current: boolean }[] {
      const st = Alpine.store('station')
      return st.recent.flatMap((id) => {
        const s = st.byId(id)
        return s ? [{ station: id, name: s.name, network: s.sub_network, current: id === st.id }] : []
      })
    },

    /* Near me: geolocation only on this tap; denied → a message, never a retry loop. */
    locate(): void {
      if (!this.geoSupported) return
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

    destroy() {
      cleanups.forEach((f) => f())
      ctl?.destroy()
      ctl = null
    },
  })
}
