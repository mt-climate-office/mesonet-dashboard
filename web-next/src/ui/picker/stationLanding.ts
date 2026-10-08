/**
 * `x-data="stationLanding"` on the no-station landing (partials/landing.html): the picker's station
 * search (./stationSearch) and the station map (`landingMap`, ui/map/presets.ts) in place of the
 * sections until a station is chosen. A pick selects it as the picker does and focuses <main>.
 */
import Alpine from 'alpinejs'
import { landingLine, unknownStationNote } from '../../core/stations/landing'
import { component } from '../component'
import { announce } from '../shell/live'
import { stationSearch } from './stationSearch'

/** landing.css's short, wide layout: the text and search beside the map. */
const SIDE_BY_SIDE = '(max-height: 560px) and (min-width: 641px)'

export function stationLanding() {
  return component({
    ...stationSearch(),

    /** A search, Near me, place or map pick: select it; the landing unmounts and the section renders. */
    choose(id: string): void {
      const st = Alpine.store('station')
      st.select(id)
      announce(`${st.byId(id)?.name ?? id} selected`)
      document.getElementById('main')?.focus({ preventScroll: true })
    },
    /** The search's list opened: the places load (the field is wide enough without the picker's sheet rules). */
    searchList(open: boolean): void {
      if (open) this.placesWanted = true
    },
    /** The long hint, except beside the map on a short, wide screen (landing.css), where the field is narrower than the drawer's. */
    searchPlaceholder(): string {
      if (!Alpine.store('station').catalog?.data) return 'Loading stations…'
      return matchMedia(SIDE_BY_SIDE).matches ? 'Station or town' : 'Station, town, county or ZIP'
    },

    line(): string {
      return landingLine(Alpine.store('station').list.length)
    },
    /** A `?s=` link the station list does not know. */
    note(): string {
      return unknownStationNote(Alpine.store('url').state.s)
    },
  })
}
