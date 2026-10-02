/**
 * `x-data="agTab"` on the Ag Tools panel (partials/ag/index.html): which
 * chart card to mount (one per variable group) and the card heading.
 * Controls live in `agControls`; each card fetches for itself.
 */
import Alpine from 'alpinejs'
import { chartState, variableGroup } from '../../core/ag/view/tab'
import { component } from '../component'
import { currentTab } from './shared'

export function agTab() {
  return component({
    /** 'chart' | 'loading-stations' | 'no-station'. */
    state(): ReturnType<typeof chartState> {
      const station = Alpine.store('station')
      return chartState(currentTab(), Alpine.store('url').state.s, station.id, station.catalog?.status !== 'loading')
    },
    /** The card for the current variable, when a chart can be drawn. */
    show(group: ReturnType<typeof variableGroup>): boolean {
      return this.state() === 'chart' && variableGroup(currentTab().variable) === group
    },
    title(): string {
      const name = Alpine.store('station').current?.name
      const label = currentTab().variableLabel
      return this.state() === 'chart' && name ? `${label}: ${name}` : label
    },
  })
}
