/**
 * `x-data="agTab"` on an open Ag tool inside Charts (partials/ag/index.html,
 * mounted while `v` is an Ag tool id): the tool's heading, its chart-card
 * state and "All charts", which returns to the Charts list (pushed, like
 * every drill-down). Controls live in `agControls`; each chart card fetches
 * for itself.
 */
import Alpine from 'alpinejs'
import { chartState, variableGroup } from '../../core/ag/view/tab'
import { CHARTS_LIST_PATCH } from '../../core/router'
import { component } from '../component'
import { follow } from '../shell/navigate'
import { currentTab } from './shared'

export function agTab() {
  return component({
    /** 'chart' | 'loading-stations' | 'no-station'. */
    state(): ReturnType<typeof chartState> {
      const station = Alpine.store('station')
      return chartState(currentTab(), Alpine.store('url').state.s, station.id, station.catalog?.status !== 'loading')
    },
    /** The card for the current tool, when a chart can be drawn. */
    show(group: ReturnType<typeof variableGroup>): boolean {
      return this.state() === 'chart' && variableGroup(currentTab().variable) === group
    },
    title(): string {
      const name = Alpine.store('station').current?.name
      const label = currentTab().variableLabel
      return this.state() === 'chart' && name ? `${label}: ${name}` : label
    },

    listHref: (): string => Alpine.store('url').hrefFor('charts', CHARTS_LIST_PATCH),
    /** "All charts": back to the list (pushed), focusing its heading. */
    toList(e: MouseEvent): void {
      follow(e, 'charts', { patch: CHARTS_LIST_PATCH, drillDown: true, target: 'charts-list-title' })
    },
  })
}
