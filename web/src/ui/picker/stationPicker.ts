/**
 * `x-data="stationPicker"` on `#station-picker` (partials/picker.html): the
 * station search (Near me inside it; places too: a picked county, reservation,
 * town or ZIP code lists its stations where Near me does), recents, and "Browse on the map"
 * (network chips + map in a full-screen kit dialog), presented by ui/layout/drawer.ts as a
 * full-height panel under the header on phones (`MCO.viewport.isCompact()`: ≤ 640 px wide or
 * ≤ 560 px tall, portrait and landscape), an overlay drawer on tablets and an inline drawer at
 * ≥ 1060 px. The header stays live in all three; tapping it (or tabbing into it) closes a modal
 * picker, except the station button, which toggles it. This wrapper picks the presentation per
 * viewport, decides when it starts open (core/stations/recent `pickerStartsOpen`) and handles the
 * picks. Openers dispatch `togglePicker(button)`.
 */
import Alpine from 'alpinejs'
import { netsValue, networkOptions } from '../../core/latest'
import { visibleStationIds } from '../../core/latest/stations'
import { pickerStartsOpen, readDrawerOpen, saveDrawerOpen } from '../../core/stations/recent'
import { browserStorage } from '../../stores/station'
import { initDrawer, type Drawer } from '../layout/drawer'
import { component } from '../component'
import { announce } from '../shell/live'
import { stationSearch } from './stationSearch'

const EVENT = 'dash:picker'
const DESKTOP_MQ = '(min-width: 1060px)'

/** Open or close the picker from any button (it becomes the focus-return target). */
export const togglePicker = (opener: HTMLElement | null): void => void window.dispatchEvent(new CustomEvent(EVENT, { detail: { opener } }))

/** panel: phones (the kit's compact rule); overlay: tablets; inline: desktop. */
type Mode = 'panel' | 'inline' | 'overlay'
const modeNow = (): Mode => (MCO.viewport.isCompact() ? 'panel' : matchMedia(DESKTOP_MQ).matches ? 'inline' : 'overlay')
/** Made inert while the picker is modal. Not the header: it stays live (its station button closes the picker). */
const background = () => [...document.querySelectorAll('.dash-content, .dash-tabbar')]
const toggles = () => [...document.querySelectorAll<HTMLElement>('[data-picker-toggle]')]

export function stationPicker() {
  let ctl: Drawer | null = null
  const cleanups: (() => void)[] = []
  // True while the picker opens or closes by itself (the saved desktop drawer, a viewport rebuild):
  // not a preference to save.
  let auto = false
  const quietly = (f: () => void) => {
    auto = true
    f()
    auto = false
  }
  const autoOpen = () => quietly(() => ctl?.open({ focus: false }))
  const mapDialog = () => document.getElementById('picker-map-modal') as HTMLDialogElement | null
  // Where focus returns when the map closes without a pick. Passed in, not read from activeElement:
  // Safari does not focus a clicked button.
  let mapOpener: HTMLElement | null = null
  return component({
    ...stationSearch(),
    open: false,
    mode: 'inline' as Mode,
    /** The map mounts on the first open of its dialog and then stays (MapLibre is costly to rebuild). */
    mapMounted: false,
    /** The search's result list is open (it fills the picker under the field: picker.css). */
    searchOpen: false,

    init() {
      this.build(false)
      const onEvent = (e: Event) => this.toggle((e as CustomEvent<{ opener: HTMLElement | null }>).detail?.opener ?? null)
      window.addEventListener(EVENT, onEvent)
      cleanups.push(() => window.removeEventListener(EVENT, onEvent))
      const desktop = matchMedia(DESKTOP_MQ)
      const onViewport = () => modeNow() !== this.mode && this.build(true)
      desktop.addEventListener('change', onViewport)
      cleanups.push(MCO.viewport.onChange(onViewport), () => desktop.removeEventListener('change', onViewport))
      // The header stays live over a modal picker: using it (a tap, or Tab into it) closes the picker first, so
      // the ⋯ menu, a section link or the logo act on the page. The station button toggles the picker itself.
      const bar = document.querySelector('.mco-navbar')
      const onBar = (e: Event) => {
        if (!ctl?.isOpen || !this.modal) return
        if (e.target instanceof Element && e.target.closest('[data-picker-toggle]')) return
        ctl.close({ restoreFocus: false })
      }
      bar?.addEventListener('click', onBar, true)
      bar?.addEventListener('focusin', onBar)
      cleanups.push(() => {
        bar?.removeEventListener('click', onBar, true)
        bar?.removeEventListener('focusin', onBar)
      })
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
        if (this.mode === 'inline' && !auto) saveDrawerOpen(browserStorage(), open)
      }
      ctl = initDrawer({ panel, scrim, toggles, background, overlay: () => this.mode !== 'inline', full: () => this.mode === 'panel', onChange })
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
    /** The panel's class; `search-open` gives the results the room under the field (picker.css). */
    panelClass(): string {
      return `dash-drawer${this.searchOpen ? ' search-open' : ''}`
    },

    toggle(opener: HTMLElement | null): void {
      if (ctl?.isOpen) return ctl.close()
      ctl?.open({ opener })
    },
    close(): void {
      ctl?.close()
    },

    /**
     * A station was picked here: select it and close the map and the picker at every size (the inline
     * drawer saves 'closed'). Focus goes to <main>, the new station's content.
     */
    choose(id: string): void {
      mapOpener = null
      mapDialog()?.close()
      const st = Alpine.store('station')
      st.select(id)
      announce(`${st.byId(id)?.name ?? id} selected`)
      ctl?.close({ restoreFocus: false })
      document.getElementById('main')?.focus({ preventScroll: true })
    },

    /* Search (./stationSearch, the kit's place search): stations, then places while typing */
    /** The search's result list opened or closed: it fills the picker under the field while open (picker.css). */
    searchList(open: boolean): void {
      this.searchOpen = open
    },
    /** The 336 px drawer has room beside "Near me" for the short hint only (picker.css); the phone panel names counties too. */
    searchPlaceholder(): string {
      const c = Alpine.store('station').catalog
      if (c?.status === 'error') return 'Failed to load stations'
      if (!c?.data) return 'Loading stations…'
      return this.mode === 'panel' ? 'Station, town, county or ZIP' : 'Station, town or ZIP'
    },

    /* Browse on the map: a full-screen kit dialog over everything, the picker included */
    openMap(opener: HTMLElement): void {
      mapOpener = opener
      this.mapMounted = true
      mapDialog()?.showModal()
    },
    /**
     * × or Esc: back to the picker. Esc is taken here (and its default, the dialog's cancel, done by hand)
     * so the picker's own Esc does not close it too.
     */
    closeMap(e?: KeyboardEvent): void {
      e?.preventDefault()
      e?.stopPropagation()
      mapDialog()?.close()
    },
    /** The dialog closed: without a pick, focus returns to "Browse on the map". */
    mapClosed(): void {
      mapOpener?.focus({ preventScroll: true })
      mapOpener = null
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

    destroy() {
      this.searchDestroy()
      cleanups.forEach((f) => f())
      ctl?.destroy()
      ctl = null
    },
  })
}
