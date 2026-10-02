/**
 * `x-data="tabBar"` on the navbar's tab links. The links are plain
 * `href="#…"` anchors (routing works without JS); this only marks the active
 * one with `aria-current="page"` and announces tab switches.
 */
import Alpine from 'alpinejs'
import { TABS, type TabHash } from '../../core/tabs'
import { component } from '../component'
import { announce } from './live'

export function tabBar() {
  return component({
    init() {
      this.$watch('$store.url.tab', (tab: TabHash) => {
        const label = TABS.find((t) => t.hash === tab)?.label
        if (label) announce(`${label} tab`)
      })
    },
    /** `aria-current` value for a tab link (false removes the attribute). */
    current(tab: TabHash): 'page' | false {
      return Alpine.store('url').tab === tab ? 'page' : false
    },
  })
}
