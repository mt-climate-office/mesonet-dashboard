/**
 * `x-data="bottomCard"` (partials/latest/cards/bottom-card.html): the bottom
 * card's switcher (Locator Map / Station Metadata / Current Conditions) over
 * `?info=` (core/cards/cardDefaults `chooseBottomCard`), plus the map's
 * network filter from `?nets=`.
 */
import Alpine from 'alpinejs'
import { BOTTOM_CARD_LABELS, chooseBottomCard } from '../../../core/cards'
import { visibleStationIds } from '../../../core/latest/stations'
import { BOTTOM_CARDS, type BottomCard } from '../../../core/url-schema'
import type { SegmentedOption } from '../../controls/segmented'
import { component } from '../../component'
import { latestObs } from './resources'

export function bottomCard() {
  return component({
    get card(): BottomCard {
      const { info, s } = Alpine.store('url').state
      const id = Alpine.store('station').id
      // Only an auto or explicit Current Conditions needs the latest request.
      const latest = id && info !== 'map' && info !== 'metadata' ? latestObs(id) : null
      return chooseBottomCard({
        explicit: info,
        hasStation: !!s,
        latestFailed: latest?.status === 'error' && !latest.data,
      })
    },

    options(): SegmentedOption[] {
      return BOTTOM_CARDS.map((v) => ({ value: v, label: BOTTOM_CARD_LABELS[v] }))
    },

    select(v: string): void {
      Alpine.store('url').set({ info: v as BottomCard })
    },

    /** Station ids the map shows for `?nets=` (the selected station always stays). */
    mapVisible(): Set<string> | null {
      const st = Alpine.store('station')
      return visibleStationIds(st.list, Alpine.store('url').state.nets, st.id)
    },
  })
}
