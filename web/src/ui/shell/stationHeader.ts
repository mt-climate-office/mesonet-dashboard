/**
 * `x-data="stationHeader"` on the header's station button (partials/shell.html):
 * the selected station's name, and the click that opens the station picker
 * (ui/picker/stationPicker.ts). Network, county and elevation live on About
 * and the Now hero, not in the header.
 */
import Alpine from 'alpinejs'
import { headerName } from '../../core/stations/header'
import { component } from '../component'
import { togglePicker } from '../picker/stationPicker'

export function stationHeader() {
  return component({
    /** Station name; '' while a linked one resolves (the empty span draws a skeleton, shell.css). */
    get name(): string {
      const st = Alpine.store('station')
      const status = st.catalog?.status
      return headerName(st.current?.name, !!Alpine.store('url').state.s, !status || status === 'loading')
    },
    get label(): string {
      return `Station: ${this.name || 'loading'}. Change station`
    },
    pick(e: Event): void {
      togglePicker(e.currentTarget as HTMLElement)
    },
  })
}
