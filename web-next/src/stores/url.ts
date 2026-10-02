/**
 * `$store.url`: the one owner of the query string and the `#tab` hash.
 * Reads core/url-schema on load and on back/forward; writes are batched into
 * one `history.replaceState` per tick, keeping the hash.
 */
import { DEFAULT_TAB, parseTabHash, type TabHash } from '../core/tabs'
import { readUrlState, writeUrlSearch, type UrlState } from '../core/url-schema'

export interface UrlStore {
  /** Every schema key, parsed (defaults filled in). Read-only: change it with `set`. */
  state: UrlState
  /** Active tab from the hash; unknown or hidden hashes read as Latest. */
  tab: TabHash
  /** Merge `patch` into `state`; the URL updates once at the end of this tick. */
  set(patch: Partial<UrlState>): void
  /** Switch tabs by setting the hash (adds a history entry, like the React app). */
  setTab(tab: TabHash): void
  init(): void
}

export function createUrlStore(): UrlStore {
  let pending = false
  // Keys ever passed to set(); lets `alwaysWrite` keys stay at their default.
  const touched = new Set<string>()
  return {
    state: readUrlState(''),
    tab: DEFAULT_TAB,

    init() {
      const sync = () => {
        this.state = readUrlState(location.search)
        this.tab = parseTabHash(location.hash)
      }
      sync()
      window.addEventListener('popstate', sync)
      window.addEventListener('hashchange', sync)
    },

    set(patch) {
      Object.assign(this.state, patch)
      for (const k of Object.keys(patch)) touched.add(k)
      if (pending) return
      pending = true
      queueMicrotask(() => {
        pending = false
        const search = writeUrlSearch(this.state, location.search, touched)
        const next = `${location.pathname}${search}${location.hash}`
        if (next !== `${location.pathname}${location.search}${location.hash}`) {
          history.replaceState(history.state, '', next)
        }
      })
    },

    setTab(tab) {
      if (location.hash !== `#${tab}`) location.hash = tab
    },
  }
}
