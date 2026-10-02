/**
 * In-app navigation between sections: `$store.url.go` (pushState for a
 * section change) inside a view transition, then scroll to the top and
 * announce the section. Used by the section nav and by tile links.
 */
import Alpine from 'alpinejs'
import { SECTIONS, sectionLabel, type Section } from '../../core/router'
import type { UrlState } from '../../core/url-schema'
import { withTransition } from '../layout/transition'
import { announce } from './live'

const order = (s: Section) => SECTIONS.findIndex((x) => x.id === s)

/** Go to `section` (optionally patching URL state); `morph` is the tapped element for a shared-element transition. */
export async function navigate(section: Section, opts: { patch?: Partial<UrlState>; morph?: HTMLElement | null } = {}): Promise<void> {
  const url = Alpine.store('url')
  const from = url.section
  await withTransition(
    async () => {
      url.go(section, opts.patch)
      await Alpine.nextTick()
    },
    { direction: order(section) < order(from) ? 'back' : 'forward', morph: opts.morph },
  )
  if (from !== section) {
    window.scrollTo({ top: 0 })
    announce(sectionLabel(section))
  }
}
