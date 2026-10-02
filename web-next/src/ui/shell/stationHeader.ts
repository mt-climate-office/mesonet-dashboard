/**
 * `x-data="stationHeader"` on the navbar station switcher and the station
 * header above the sections (partials/shell.html): the selected station's
 * name and "network · county · elevation" line, and the button that opens the
 * station picker (ui/picker/stationPicker.ts).
 */
import Alpine from 'alpinejs'
import { metersToFeet } from '../../core/cards'
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
    get hasStation(): boolean {
      return !!Alpine.store('station').current
    },
    /** "HydroMet · Gallatin County · 4,859 ft". */
    get meta(): string {
      const s = Alpine.store('station').current
      if (!s) return ''
      const ft = Number.isFinite(s.elevation) ? `${metersToFeet(s.elevation).toLocaleString('en-US')} ft` : null
      return [s.sub_network, s.county ? `${s.county} County` : null, ft].filter(Boolean).join(' · ')
    },
    pick(e: Event): void {
      togglePicker(e.currentTarget as HTMLElement)
    },
  })
}
