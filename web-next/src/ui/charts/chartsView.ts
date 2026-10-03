/**
 * `x-data="chartsView"` on the Charts section (partials/charts/index.html):
 * which view the URL asks for (core/variables `chartsMode`: list, variable
 * page or Compare) and the "All variables" link back to the list, which
 * pushes history like every drill-down.
 */
import Alpine from 'alpinejs'
import { chartsMode } from '../../core/variables'
import { component } from '../component'
import { navigate } from '../shell/navigate'

const LIST = { v: null, view: 'recent', cmp: false } as const

export function chartsView() {
  return component({
    get mode(): 'list' | 'variable' | 'compare' {
      return chartsMode(Alpine.store('url').state)
    },
    listHref(): string {
      return Alpine.store('url').hrefFor('charts', LIST)
    },
    toList(e: MouseEvent): void {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      void navigate('charts', { patch: LIST, drillDown: true })
    },
  })
}
