/**
 * `x-data="chartsView"` on the Charts section (partials/charts/index.html):
 * which view the URL asks for (core/variables `chartsMode`: list, variable
 * page or Compare) and the "All variables" link back to the list, which
 * pushes history like every drill-down.
 */
import Alpine from 'alpinejs'
import { CHARTS_LIST_PATCH } from '../../core/router'
import { chartsMode } from '../../core/variables'
import { component } from '../component'
import { follow } from '../shell/navigate'

export function chartsView() {
  return component({
    get mode(): 'list' | 'variable' | 'compare' {
      return chartsMode(Alpine.store('url').state)
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
