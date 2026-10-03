/**
 * `x-data="stationHeader"` on the header's station button (partials/shell.html):
 * the selected station's name, and the click that opens the station picker
 * (ui/picker/stationPicker.ts). Network, county and elevation live on About
 * and the Now hero, not in the header.
 */
import Alpine from 'alpinejs'
import { component } from '../component'
import { togglePicker } from '../picker/stationPicker'

export function stationHeader() {
  return component({
    /** Station name; "Choose a station" without one, "Loading…" while a linked one resolves. */
    get name(): string {
      const st = Alpine.store('station')
      if (st.current) return st.current.name
      return Alpine.store('url').state.s && st.catalog?.status === 'loading' ? 'Loading…' : 'Choose a station'
    },
    pick(e: Event): void {
      togglePicker(e.currentTarget as HTMLElement)
    },
  })
}
