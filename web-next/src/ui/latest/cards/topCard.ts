/**
 * `x-data="topCard"` (partials/latest/cards/top-card.html): the top card's
 * switcher (Wind Rose / Weather Forecast / Latest Photo) over `?card=`.
 * Which card shows is core/cards/cardDefaults `chooseTopCard`.
 */
import Alpine from 'alpinejs'
import { TOP_CARD_LABELS, chooseTopCard, type TopCardChoice } from '../../../core/cards'
import { hasCamera } from '../../../core/photos'
import { TOP_CARDS, type TopCard } from '../../../core/url-schema'
import type { SegmentedOption } from '../../controls/segmented'
import { component } from '../../component'
import { photoSchedule } from '../../station/resources'

export function topCard() {
  return component({
    get choice(): TopCardChoice {
      const id = Alpine.store('station').id
      const schedule = photoSchedule()
      return chooseTopCard({
        explicit: Alpine.store('url').state.card,
        station: id,
        hasCamera: hasCamera(schedule.data, id),
        schedule: schedule.status,
      })
    },

    get card(): TopCard {
      return this.choice.card
    },

    /** The pane to render: none while the auto choice waits on the schedule. */
    get pane(): TopCard | 'pending' {
      return this.choice.pending ? 'pending' : this.choice.card
    },

    options(): SegmentedOption[] {
      const photo = this.choice.photoEnabled
      return TOP_CARDS.map((v) => ({ value: v, label: TOP_CARD_LABELS[v], disabled: v === 'photo' && !photo }))
    },

    select(v: string): void {
      Alpine.store('url').set({ card: v as TopCard })
    },
  })
}
