/**
 * `$store.data`: the one fetch cache. `cached(key, fetcher, {ttl, retry})`
 * returns a reactive `{status, data, error, refresh}` (see core/cache.ts for
 * dedupe, TTL, retry and stale-response rules).
 */
import Alpine from 'alpinejs'
import { createCache, type Cache } from '../core/cache'

export type DataStore = Cache

export function createDataStore(): DataStore {
  return createCache({ reactive: Alpine.reactive })
}
