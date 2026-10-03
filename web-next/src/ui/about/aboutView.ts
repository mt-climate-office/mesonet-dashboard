/**
 * `x-data="aboutView"` on the About section (partials/about/index.html):
 * whether a station is ready, the "Choose a station" opener, and the data
 * notes' API links. The cards inside are their own components.
 */
import Alpine from 'alpinejs'
import { apiLinks, type ApiLink } from '../../core/about'
import { component } from '../component'
import { togglePicker } from '../picker/stationPicker'

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

    pick(e: Event): void {
      togglePicker(e.currentTarget as HTMLElement)
    },
  })
}
