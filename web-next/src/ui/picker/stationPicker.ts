/**
 * `x-data="stationPicker"` on `#station-picker` (partials/picker.html): the
 * station search, Near me, recents, network chips and map, presented as a
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
import { formatMiles, nearestStations } from '../../core/stations/nearest'
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
type Ctl = { open(o?: { opener?: HTMLElement | null; focus?: boolean }): void; close(o?: { restoreFocus?: boolean }): void; readonly isOpen: boolean; destroy(): void }
type Near = { status: 'idle' | 'locating' | 'ready' | 'denied' | 'error'; rows: { station: string; name: string; dist: string }[] }

const modeNow = (): Mode => (MCO.viewport.isCompact() ? 'sheet' : matchMedia(DESKTOP_MQ).matches ? 'inline' : 'overlay')
const background = () => [...document.querySelectorAll('.mco-navbar, .dash-content, .dash-tabbar')]
const toggles = () => [...document.querySelectorAll<HTMLElement>('[data-picker-toggle]')]

export function stationPicker() {
  let ctl: Ctl | null = null
  const cleanups: (() => void)[] = []
  return component({
    open: false,
    mode: 'inline' as Mode,
    /** The map mounts on the first open and then stays (MapLibre is costly to rebuild). */
    mapMounted: false,
    near: { status: 'idle', rows: [] } as Near,
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
      Alpine.effect(() => {
        const st = Alpine.store('station')
        if (st.catalog?.status === 'success' && !st.id && !ctl?.isOpen) ctl?.open({ focus: false })
      })
    },

    /** (Re)create the presentation for the current viewport and apply the start rule. */
    build(viewportChange: boolean): void {
      ctl?.close({ restoreFocus: false })
      ctl?.destroy()
      const panel = this.$el as HTMLElement
      const scrim = document.getElementById('picker-scrim')
      this.mode = modeNow()
      const onChange = (open: boolean) => {
        this.open = open
        if (open) this.mapMounted = true
        if (this.mode === 'inline') saveDrawerOpen(browserStorage(), open)
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
      // On load nothing animates or steals focus; after a resize the panel may animate.
      if (start) {
        if (!viewportChange) panel.classList.add('no-anim')
        ctl.open({ focus: false })
        requestAnimationFrame(() => panel.classList.remove('no-anim'))
      }
      this.open = ctl.isOpen
    },

    get modal(): boolean {
      return this.mode !== 'inline'
    },

    toggle(opener: HTMLElement | null): void {
      if (ctl?.isOpen) ctl.close()
      else ctl?.open({ opener })
    },
    close(): void {
      ctl?.close()
    },

    /** A station was picked here: select it; modal presentations close (focus back to the opener). */
    choose(id: string | null): void {
      if (!id) return
      const st = Alpine.store('station')
      st.select(id)
      announce(`${st.byId(id)?.name ?? id} selected`)
      if (this.modal) ctl?.close()
    },

    /* Search (ui/controls/combobox) */
    items(): ComboboxItem[] {
      const st = Alpine.store('station')
      return stationItems(st.list, Alpine.store('url').state.nets, st.id)
    },
    searchPlaceholder(): string {
      const c = Alpine.store('station').catalog
      return c?.status === 'error' ? 'Failed to load stations' : c?.data ? 'Search by name or ID' : 'Loading stations…'
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
    recent(): { station: string; name: string; current: boolean }[] {
      const st = Alpine.store('station')
      return st.recent.flatMap((id) => {
        const s = st.byId(id)
        return s ? [{ station: id, name: s.name, current: id === st.id }] : []
      })
    },

    /* Near me: geolocation only on this tap; denied → a message, never a retry loop. */
    locate(): void {
      if (!this.geoSupported) return
      this.near = { status: 'locating', rows: [] }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const rows = nearestStations(Alpine.store('station').list, pos.coords.latitude, pos.coords.longitude)
          this.near = { status: 'ready', rows: rows.map((r) => ({ station: r.station, name: r.name, dist: formatMiles(r.miles) })) }
          announce(`${rows.length} stations near you`)
        },
        (err) => {
          this.near = { status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error', rows: [] }
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
