/**
 * In-app navigation: `navigate` runs `$store.url.go` (pushState for a section
 * change or a drill-down) inside a view transition, then scrolls, moves focus
 * and announces a new section. `follow` is the one click handler for an
 * in-app `<a href>`: a plain left click navigates, anything else (new tab,
 * middle click) follows the real href.
 */
import Alpine from 'alpinejs'
import { SECTIONS, sectionLabel, type Section } from '../../core/router'
import type { UrlState } from '../../core/url-schema'
import { withTransition } from '../layout/transition'
import { announce } from './live'

const order = (s: Section) => SECTIONS.findIndex((x) => x.id === s)

export interface NavigateOptions {
  /** URL state to apply with the move. */
  patch?: Partial<UrlState>
  /** The tapped element, for a shared-element transition into `[data-vt-target]`. */
  morph?: HTMLElement | null
  /** Add a history entry inside the section (an Ag tool, a Charts variable or sub-view). */
  drillDown?: boolean
  /**
   * Id of the element that takes focus (it needs `tabindex="-1"` unless it is
   * focusable), so focus never falls to <body> when the clicked link unmounts.
   * The page scrolls to the top as usual, then to the target if that left it
   * below the fold (Now's "All readings" → `#about-readings`).
   */
  target?: string
}

/** Go to `section` (see NavigateOptions). */
export async function navigate(section: Section, opts: NavigateOptions = {}): Promise<void> {
  const url = Alpine.store('url')
  const from = url.section
  await withTransition(
    async () => {
      url.go(section, opts.patch, opts.drillDown)
      await Alpine.nextTick()
    },
    { direction: order(section) < order(from) ? 'back' : 'forward', morph: opts.morph },
  )
  // A target inside an x-for under an x-if renders one tick after the x-if.
  if (opts.target) await Alpine.nextTick()
  if (from !== section || opts.drillDown) window.scrollTo({ top: 0 })
  const target = opts.target ? document.getElementById(opts.target) : null
  if (target && target.getBoundingClientRect().bottom > window.innerHeight) target.scrollIntoView({ block: 'start' })
  target?.focus({ preventScroll: true })
  if (from !== section) announce(sectionLabel(section))
}

/**
 * Scroll element `id` into view as soon as it exists (it may render after
 * data loads), once; gives up after 15 s. For a link that lands mid-page
 * (a bare legacy `#ag` → the Charts list's Ag tools group).
 */
export function revealWhenReady(id: string): void {
  const reveal = () => {
    const el = document.getElementById(id)
    if (!el) return false
    el.scrollIntoView({ block: 'start' })
    return true
  }
  if (reveal()) return
  const mo = new MutationObserver(() => reveal() && stop())
  const timer = window.setTimeout(() => stop(), 15_000)
  const stop = () => {
    mo.disconnect()
    clearTimeout(timer)
  }
  mo.observe(document.body, { childList: true, subtree: true })
}

/** A plain left click (no modifier key): handled in-app; anything else follows the href. */
const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

/** Click handler for an in-app link: a plain click is `navigate(section, opts)` instead of the href. */
export function follow(e: MouseEvent, section: Section, opts: NavigateOptions = {}): void {
  if (!plainClick(e)) return
  e.preventDefault()
  void navigate(section, opts)
}
