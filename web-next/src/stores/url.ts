/**
 * `$store.url`: the one owner of the query string and the `#section` hash.
 * Reads core/url-schema on load and on back/forward. `set` batches into one
 * `history.replaceState` per tick (in-section state); `go` changes section
 * with `history.pushState` so Back returns (core/router.ts `historyMode`).
 */
import { type BackTo, historyMode, nextBackTo, parseSection, readBackTo, sectionForHash, type Section } from '../core/router'
import { readUrlState, viewHref, writeUrlSearch, type UrlState } from '../core/url-schema'
import { chartsMode } from '../core/variables'

export interface UrlStore {
  /** Every schema key, parsed (defaults filled in). Read-only: change it with `set`. */
  state: UrlState
  /** Active section from the hash; unknown hashes read as Now, legacy tab names map (core/router). */
  section: Section
  /**
   * Where a chart page's back arrow returns: the section it was opened from and how many history
   * entries ago (core/router `nextBackTo`), kept in `history.state`; null = the Charts list.
   */
  backTo: BackTo | null
  /** Absolute URL of the current view, including writes not yet flushed (Share copies it). */
  readonly href: string
  /** Merge `patch` into `state`; the URL updates once at the end of this tick (replaceState). */
  set(patch: Partial<UrlState>): void
  /** URL (`?…#section`) for `section` with `patch` applied: real hrefs for section links. */
  hrefFor(section: Section, patch?: Partial<UrlState>): string
  /**
   * Go to `section` (with an optional patch): pushState for a section change
   * or a drill-down (a Charts variable or Ag tool, a sub-view), else replaceState.
   */
  go(section: Section, patch?: Partial<UrlState>, drillDown?: boolean, from?: Section): void
  init(): void
}

export function createUrlStore(): UrlStore {
  let pending = false
  let booted = false
  const path = () => location.pathname
  return {
    state: readUrlState(''),
    section: 'now',
    backTo: null,

    init() {
      const sync = () => {
        this.state = readUrlState(location.search)
        // Boot reads the hash as is; later changes ignore in-page anchors such as the skip link's #main.
        this.section = booted ? sectionForHash(location.hash, this.section) : parseSection(location.hash)
        this.backTo = readBackTo(history.state)
        booted = true
      }
      sync()
      window.addEventListener('popstate', sync)
      window.addEventListener('hashchange', sync)
    },

    get href() {
      return viewHref(location, this.state)
    },

    set(patch) {
      Object.assign(this.state, patch)
      if (pending) return
      pending = true
      queueMicrotask(() => {
        pending = false
        const search = writeUrlSearch(this.state, location.search)
        const next = `${path()}${search}${location.hash}`
        if (next !== `${path()}${location.search}${location.hash}`) {
          history.replaceState(history.state, '', next)
        }
      })
    },

    hrefFor(section, patch = {}) {
      return `${path()}${writeUrlSearch({ ...this.state, ...patch }, location.search)}#${section}`
    },

    go(section, patch = {}, drillDown = false, from) {
      const next = this.hrefFor(section, patch)
      Object.assign(this.state, patch)
      if (historyMode(this.section, section, drillDown) === 'push') {
        const back = nextBackTo({ current: this.backTo, from, sameSection: section === this.section, drillDown, toList: section === 'charts' && chartsMode(this.state) === 'list' })
        // The plain object, not the store's reactive proxy: history.state must be cloneable.
        history.pushState(back ? { backTo: back } : null, '', next)
        this.backTo = back
      } else history.replaceState(history.state, '', next)
      this.section = section
    },
  }
}
