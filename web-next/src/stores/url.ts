/**
 * `$store.url`: the one owner of the query string and the `#section` hash.
 * Reads core/url-schema on load and on back/forward. `set` batches into one
 * `history.replaceState` per tick (in-section state); `go` changes section
 * with `history.pushState` so Back returns (core/router.ts `historyMode`).
 */
import { historyMode, parseSection, sectionForHash, type Section } from '../core/router'
import { readUrlState, viewHref, writeUrlSearch, type UrlState } from '../core/url-schema'

export interface UrlStore {
  /** Every schema key, parsed (defaults filled in). Read-only: change it with `set`. */
  state: UrlState
  /** Active section from the hash; unknown hashes read as Now, legacy tab names map (core/router). */
  section: Section
  /** Absolute URL of the current view, including writes not yet flushed (Share copies it). */
  readonly href: string
  /** Merge `patch` into `state`; the URL updates once at the end of this tick (replaceState). */
  set(patch: Partial<UrlState>): void
  /** URL (`?…#section`) for `section` with `patch` applied: real hrefs for section links. */
  hrefFor(section: Section, patch?: Partial<UrlState>): string
  /** Go to `section` (with an optional patch): pushState for a section change, else replaceState. */
  go(section: Section, patch?: Partial<UrlState>): void
  init(): void
}

export function createUrlStore(): UrlStore {
  let pending = false
  let booted = false
  // Keys ever passed to set()/go(); lets `alwaysWrite` keys stay at their default.
  const touched = new Set<string>()
  const path = () => location.pathname
  return {
    state: readUrlState(''),
    section: 'now',

    init() {
      const sync = () => {
        this.state = readUrlState(location.search)
        // Boot reads the hash as is; later changes ignore in-page anchors such as the skip link's #main.
        this.section = booted ? sectionForHash(location.hash, this.section) : parseSection(location.hash)
        booted = true
      }
      sync()
      window.addEventListener('popstate', sync)
      window.addEventListener('hashchange', sync)
    },

    get href() {
      return viewHref(location, this.state, touched)
    },

    set(patch) {
      Object.assign(this.state, patch)
      for (const k of Object.keys(patch)) touched.add(k)
      if (pending) return
      pending = true
      queueMicrotask(() => {
        pending = false
        const search = writeUrlSearch(this.state, location.search, touched)
        const next = `${path()}${search}${location.hash}`
        if (next !== `${path()}${location.search}${location.hash}`) {
          history.replaceState(history.state, '', next)
        }
      })
    },

    hrefFor(section, patch = {}) {
      const keys = new Set([...touched, ...Object.keys(patch)])
      return `${path()}${writeUrlSearch({ ...this.state, ...patch }, location.search, keys)}#${section}`
    },

    go(section, patch = {}) {
      const next = this.hrefFor(section, patch)
      Object.assign(this.state, patch)
      for (const k of Object.keys(patch)) touched.add(k)
      if (historyMode(this.section, section) === 'push') history.pushState(null, '', next)
      else history.replaceState(history.state, '', next)
      this.section = section
    },
  }
}
