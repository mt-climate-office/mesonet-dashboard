/**
 * `$store.data`: the one fetch cache. `cached(key, fetcher, {ttl, retry, live, slot})`
 * returns a reactive `{status, data, error, refresh}` (see core/cache.ts for
 * dedupe, TTL, retry and stale-response rules). `tick` is the freshness tick
 * (core/freshness.ts): every `live` read depends on it, so a page left open
 * re-reads, and refetches past each TTL, every 5 min and on return to the tab.
 */
import Alpine from 'alpinejs'
import { createCache, type Cache } from '../core/cache'
import { createTicker } from '../core/freshness'

export type DataStore = Cache & { readonly tick: number; init(): void }

export function createDataStore(): DataStore {
  const clock = Alpine.reactive({ tick: 0 })
  return {
    ...createCache({ reactive: Alpine.reactive, track: () => clock.tick }),
    get tick() {
      return clock.tick
    },
    init() {
      const ticker = createTicker({ onTick: () => clock.tick++ })
      const sync = () => (document.visibilityState === 'visible' ? ticker.visible() : ticker.hidden())
      document.addEventListener('visibilitychange', sync)
      // A bfcache restore (phone browsers) may not fire visibilitychange.
      window.addEventListener('pageshow', (e) => e.persisted && ticker.restored())
      sync()
    },
  }
}
