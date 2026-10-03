/**
 * `x-data="sections"` on the two section navs in partials/shell.html (phone
 * tab bar, desktop segmented row): the Alpine wrapper over
 * ui/layout/sectionNav.ts. Marks the current section from `$store.url.section`
 * and routes clicks through ui/shell/navigate.ts with core/router
 * `sectionNavPatch` (Charts inside Charts → the list, Ag inside Ag → the tool
 * cards; leaving Charts drops `v`). With `data-publish="--tabbar-h"` it also
 * keeps that property equal to the bar's height.
 */
import Alpine from 'alpinejs'
import { parseSection, sectionNavPatch, type Section } from '../../core/router'
import { initSectionNav, publishHeight, type SectionNav } from '../layout/sectionNav'
import { component } from '../component'
import { follow } from './navigate'

/** Patch + history mode for a tap on `to` from the current section. */
const navFor = (to: Section) => {
  const url = Alpine.store('url')
  return sectionNavPatch(url.section, to, url.state)
}

export function sections() {
  let nav: SectionNav | null = null
  let unpublish: (() => void) | null = null
  let effect: ReturnType<typeof Alpine.effect> | null = null
  return component({
    init() {
      const el = this.$el as HTMLElement
      nav = initSectionNav({
        root: el,
        onNavigate: (e, s) => {
          const to = parseSection(s)
          follow(e, to, navFor(to))
        },
      })
      effect = Alpine.effect(() => nav?.setCurrent(Alpine.store('url').section))
      if (el.dataset.publish) unpublish = publishHeight(el, el.dataset.publish)
    },
    /** href for a section link that keeps the current query (no-JS and new-tab fallback). */
    href(section: string): string {
      const to = parseSection(section)
      return Alpine.store('url').hrefFor(to, navFor(to).patch)
    },
    destroy() {
      if (effect) Alpine.release(effect)
      nav?.destroy()
      unpublish?.()
    },
  })
}
