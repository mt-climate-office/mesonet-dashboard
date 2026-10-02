/**
 * Keyed fetch cache behind `$store.data.cached()` (stores/data.ts). Pure apart
 * from timers: the reactive wrapper, clock and sleep are injected, so it is
 * unit-tested in Node and Alpine supplies `Alpine.reactive` at runtime.
 */
import { retryDelayMs, shouldRetry } from './api/retry'

export type ResourceStatus = 'loading' | 'success' | 'error'

/** What `cached()` returns: one live object per key, updated in place. */
export interface Resource<T> {
  status: ResourceStatus
  /** Last successful value; kept while a stale entry refetches. */
  data: T | undefined
  error: unknown
  /** Force a refetch now (e.g. a Retry button after an error). */
  refresh: () => void
}

export interface CachedOptions {
  /** Freshness window in ms (default 5 min; `Infinity` = never refetch). */
  ttl?: number
  /** Retry network/5xx failures (default true; 4xx never retries). */
  retry?: boolean
}

export interface CacheDeps {
  /** Wraps the new resource so the UI tracks it (Alpine.reactive). */
  reactive?: <T extends object>(o: T) => T
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

interface Entry {
  res: Resource<unknown>
  fetchedAt: number
  ttl: number
  inFlight: boolean
  /** Bumped per fetch; a response from an older fetch is ignored. */
  gen: number
  run: () => void
}

export const DEFAULT_TTL_MS = 5 * 60 * 1000

/**
 * Create a cache. `cached(key, fetcher, opts)`:
 *  - first call for `key` starts the fetch (status 'loading');
 *  - later calls return the same object; in-flight requests are shared;
 *  - once older than `ttl`, the next call refetches in the background
 *    (status and data stay as they were until the new value lands);
 *  - errors stay errors until `refresh()` — reading an errored key never
 *    refetches by itself, so a template re-render cannot loop on a failure.
 * The fetcher is captured on the first call for a key; keys must encode
 * every input the fetcher depends on.
 */
export function createCache(deps: CacheDeps = {}) {
  const reactive = deps.reactive ?? (<T extends object>(o: T) => o)
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const entries = new Map<string, Entry>()

  function cached<T>(key: string, fetcher: () => Promise<T>, opts: CachedOptions = {}): Resource<T> {
    const hit = entries.get(key)
    if (hit) {
      const stale = now() - hit.fetchedAt > hit.ttl
      if (stale && !hit.inFlight && hit.res.status === 'success') hit.run()
      return hit.res as Resource<T>
    }
    const retry = opts.retry ?? true
    const entry: Entry = {
      res: reactive({
        status: 'loading' as ResourceStatus,
        data: undefined as unknown,
        error: null as unknown,
        refresh: () => entry.run(),
      }),
      fetchedAt: -Infinity,
      ttl: opts.ttl ?? DEFAULT_TTL_MS,
      inFlight: false,
      gen: 0,
      run: () => void load(),
    }
    async function load() {
      const gen = ++entry.gen
      entry.inFlight = true
      if (entry.res.status === 'error') entry.res.status = 'loading'
      for (let attempt = 1; ; attempt++) {
        try {
          const value = await fetcher()
          if (gen !== entry.gen) return
          entry.res.data = value
          entry.res.error = null
          entry.res.status = 'success'
          entry.fetchedAt = now()
          break
        } catch (err) {
          if (gen !== entry.gen) return
          if (retry && shouldRetry(err, attempt)) {
            await sleep(retryDelayMs(attempt))
            if (gen !== entry.gen) return
            continue
          }
          entry.res.error = err
          entry.res.status = 'error'
          break
        }
      }
      entry.inFlight = false
    }
    entries.set(key, entry)
    entry.run()
    return entry.res as Resource<T>
  }

  /** Drop every entry whose key starts with `prefix` (all when omitted). */
  function invalidate(prefix = ''): void {
    for (const k of [...entries.keys()]) if (k.startsWith(prefix)) entries.delete(k)
  }

  return { cached, invalidate }
}

export type Cache = ReturnType<typeof createCache>
