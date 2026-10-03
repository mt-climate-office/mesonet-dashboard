/**
 * `x-data="aboutDetails"` (partials/about/details.html): the station's
 * details (core/about `stationDetails`; the period of record ends at the
 * newest `/latest` report) and its one-pager link when one is listed.
 */
import Alpine from 'alpinejs'
import { stationDetails, type DetailRow } from '../../core/about'
import { findOnePager } from '../../core/cards'
import { component } from '../component'
import { latestObs, onePagers } from '../station/resources'

export function aboutDetails() {
  return component({
    get rows(): DetailRow[] {
      const s = Alpine.store('station').current
      if (!s) return []
      return stationDetails(s, latestObs(s.station).data?.[0]?.datetime)
    },

    get onePager(): string | null {
      const s = Alpine.store('station').current
      return s ? findOnePager(onePagers().data, s.station) : null
    },
  })
}
