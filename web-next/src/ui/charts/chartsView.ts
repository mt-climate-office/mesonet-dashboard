/**
 * `x-data="chartsView"` on the Charts section (partials/charts/index.html):
 * which view the URL asks for (core/variables `chartsMode`: list, variable
 * page, Ag tool or Compare), whether Compare's inputs are in, and the "All
 * variables" link back to the list, which pushes history like every drill-down.
 */
import Alpine from 'alpinejs'
import { CHARTS_LIST_PATCH } from '../../core/router'
import { chartsMode } from '../../core/variables'
import { component } from '../component'
import { follow } from '../shell/navigate'
import { elementsResource } from './resources'

export function chartsView() {
  return component({
    get mode(): ReturnType<typeof chartsMode> {
      return chartsMode(Alpine.store('url').state)
    },
    /**
     * Compare's options and plot wait for the station list and the station's element list (they decide
     * the chips and the panels), so nothing shifts when they land; a failure shows Compare's error state.
     */
    compareReady(): boolean {
      const st = Alpine.store('station')
      if (st.catalog?.status === 'loading') return false
      return !st.id || elementsResource(st.id)?.status !== 'loading'
    },
    listHref(): string {
      return Alpine.store('url').hrefFor('charts', CHARTS_LIST_PATCH)
    },
    /** "All variables": back to the list (pushed), focusing its heading. */
    toList(e: MouseEvent): void {
      follow(e, 'charts', { patch: CHARTS_LIST_PATCH, drillDown: true, target: 'charts-list-title' })
    },
  })
}
