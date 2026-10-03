/**
 * `x-data="aboutView"` on the About section (partials/about/index.html):
 * whether a station is ready, the "Choose a station" opener, the two rows
 * that open the readings and sensor-change sheets (with their count and
 * latest date), and the data notes' API links. The details card is its own
 * component; the sheets live in partials/sheets/.
 */
import Alpine from 'alpinejs'
import { apiLinks, type ApiLink } from '../../core/about'
import { component } from '../component'
import { togglePicker } from '../picker/stationPicker'
import { closeSheet, openSheet } from '../shell/sheet'
import { sensorChanges } from './history'
import { currentReadings } from './readings'

const SHEETS = ['about-readings', 'about-history'] as const

export function aboutView() {
  return component({
    get state(): 'none' | 'loading' | 'missing' | 'ready' {
      const st = Alpine.store('station')
      if (st.current) return 'ready'
      if (!Alpine.store('url').state.s) return 'none'
      return st.catalog?.status === 'loading' ? 'loading' : 'missing'
    },

    get links(): ApiLink[] {
      const id = Alpine.store('station').id
      return id ? apiLinks(id) : []
    },

    /** How many readings the station reports now (Observed not counted); '' until `/latest` answers. */
    get readingsMeta(): string {
      const n = currentReadings(Alpine.store('station').id).filter((r) => r.col !== 'Timestamp').length
      return n ? String(n) : ''
    },

    /** The newest sensor change's date; '' until the config answers or without changes. */
    get changesMeta(): string {
      return sensorChanges(Alpine.store('station').id)[0]?.label ?? ''
    },

    /** A row: open its sheet; focus returns to the row on close. */
    open(e: Event, id: (typeof SHEETS)[number]): void {
      openSheet(id, e.currentTarget as HTMLElement)
    },

    pick(e: Event): void {
      togglePicker(e.currentTarget as HTMLElement)
    },

    /** Leaving About (Back while a sheet is open) closes its sheets. */
    destroy() {
      SHEETS.forEach(closeSheet)
    },
  })
}
