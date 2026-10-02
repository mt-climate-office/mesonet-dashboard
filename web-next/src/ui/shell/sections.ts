/**
 * `x-data="sections"` on the two section navs in partials/shell.html (phone
 * tab bar, desktop segmented row): the Alpine wrapper over
 * ui/layout/sectionNav.ts. Marks the current section from `$store.url.section`
 * and routes clicks through ui/shell/navigate.ts. With `data-publish="--tabbar-h"`
 * it also keeps that property equal to the bar's height.
 */
import Alpine from 'alpinejs'
import { parseSection } from '../../core/router'
import { initSectionNav, publishHeight, type SectionNav } from '../layout/sectionNav'
import { component } from '../component'
import { navigate } from './navigate'

export function sections() {
  let nav: SectionNav | null = null
  let unpublish: (() => void) | null = null
  let effect: ReturnType<typeof Alpine.effect> | null = null
  return component({
    init() {
      const el = this.$el as HTMLElement
      nav = initSectionNav({ root: el, onNavigate: (s) => void navigate(parseSection(s)) })
      effect = Alpine.effect(() => nav?.setCurrent(Alpine.store('url').section))
      if (el.dataset.publish) unpublish = publishHeight(el, el.dataset.publish)
    },
    /** href for a section link that keeps the current query (no-JS and new-tab fallback). */
    href(section: string): string {
      return Alpine.store('url').hrefFor(parseSection(section))
    },
    destroy() {
      if (effect) Alpine.release(effect)
      nav?.destroy()
      unpublish?.()
    },
  })
}
