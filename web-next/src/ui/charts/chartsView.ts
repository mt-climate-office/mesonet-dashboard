/**
 * `x-data="chartsView"` on the Charts section (partials/charts/index.html):
 * which view the URL asks for (core/variables `chartsMode`: list, variable
 * page, Ag tool or Compare), whether Compare's inputs are in, and the back
 * arrow: to Now when a Now tile opened the chart, else to the list (pushed,
 * like every drill-down).
 */
import Alpine from 'alpinejs'
import { CHARTS_LIST_PATCH } from '../../core/router'
import { chartsMode } from '../../core/variables'
import { component } from '../component'
import { sectionLabel } from '../../core/router'
import { backFromChart, follow } from '../shell/navigate'
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
    /** The back arrow's href: where the chart was opened from (Now), else the list. */
    listHref(): string {
      const url = Alpine.store('url')
      return url.backTo ? url.hrefFor(url.backTo.section) : url.hrefFor('charts', CHARTS_LIST_PATCH)
    },
    /** The back arrow's name: "Back to Now", else `list` ("All variables", "All charts"). */
    backLabel(list: string): string {
      const back = Alpine.store('url').backTo
      return back ? `Back to ${sectionLabel(back.section)}` : list
    },
    /** Back: to Now through history when the chart was opened there, else the list (pushed), focusing its heading. */
    toList(e: MouseEvent): void {
      backFromChart(e, () => follow(e, 'charts', { patch: CHARTS_LIST_PATCH, drillDown: true, target: 'charts-list-title' }))
    },
  })
}
