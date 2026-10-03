/**
 * In-app navigation between sections: `$store.url.go` (pushState for a
 * section change) inside a view transition, then scroll to the top and
 * announce the section. Used by the section nav and by tile links.
 * `target` scrolls to (and focuses) an element in the new section instead
 * of the top, e.g. Now's "All readings" → `#about-readings`.
 */
import Alpine from 'alpinejs'
import { SECTIONS, sectionLabel, type Section } from '../../core/router'
import type { UrlState } from '../../core/url-schema'
import { withTransition } from '../layout/transition'
import { announce } from './live'

const order = (s: Section) => SECTIONS.findIndex((x) => x.id === s)

/**
 * Go to `section` (optionally patching URL state); `morph` is the tapped element for a shared-element
 * transition; `drillDown` adds a history entry inside the section (an Ag tool opened from its card, a Charts variable or sub-view);
 * `target` is the id of an element to land on (it needs `tabindex="-1"`).
 */
export async function navigate(
  section: Section,
  opts: { patch?: Partial<UrlState>; morph?: HTMLElement | null; drillDown?: boolean; target?: string } = {},
): Promise<void> {
  const url = Alpine.store('url')
  const from = url.section
  await withTransition(
    async () => {
      url.go(section, opts.patch, opts.drillDown)
      await Alpine.nextTick()
    },
    { direction: order(section) < order(from) ? 'back' : 'forward', morph: opts.morph },
  )
  const target = opts.target ? document.getElementById(opts.target) : null
  if (target) {
    target.scrollIntoView({ block: 'start' })
    target.focus({ preventScroll: true })
  } else if (from !== section || opts.drillDown) {
    window.scrollTo({ top: 0 })
  }
  if (from !== section) announce(sectionLabel(section))
}
