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
  /** Time-sensitive: this read depends on the freshness tick (`deps.track`), so it re-runs, and refetches past `ttl`, on each tick. */
  live?: boolean
  /** Entries sharing a slot (a key that carries today's date): a new key shows the slot's last data while it loads. */
  slot?: string
}

export interface CacheDeps {
  /** Wraps the new resource so the UI tracks it (Alpine.reactive). */
  reactive?: <T extends object>(o: T) => T
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  /** Called on every `live` read: reads the reactive freshness tick (stores/data.ts). */
  track?: () => void
}

interface Entry {
  res: Resource<unknown>
  /** When the last fetch finished, successful or not. */
  settledAt: number
  ttl: number
  inFlight: boolean
  /** Bumped per fetch; a response from an older fetch is ignored. */
  gen: number
  run: () => void
}

export const DEFAULT_TTL_MS = 5 * 60 * 1000

/**
 * Create a cache. `cached(key, fetcher, opts)`:
 *  - first call for `key` starts the fetch (status 'loading', or the slot's
 *    last data with status 'success');
 *  - later calls return the same object; in-flight requests are shared;
 *  - once the last fetch is older than `ttl`, the next call refetches in the
 *    background (status and data stay as they were until the new value lands);
 *  - a failed fetch keeps the last good data (status 'success', `error` set)
 *    or, with none, is an error; either way it is retried only after `ttl`
 *    (or on `refresh()`), so a template re-render cannot loop on a failure.
 * The fetcher is captured on the first call for a key; keys must encode
 * every input the fetcher depends on.
 */
export function createCache(deps: CacheDeps = {}) {
  const reactive = deps.reactive ?? (<T extends object>(o: T) => o)
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const track = deps.track ?? (() => {})
  const entries = new Map<string, Entry>()
  const slots = new Map<string, unknown>()

  function cached<T>(key: string, fetcher: () => Promise<T>, opts: CachedOptions = {}): Resource<T> {
    if (opts.live) track()
    const hit = entries.get(key)
    if (hit) {
      if (!hit.inFlight && now() - hit.settledAt > hit.ttl) hit.run()
      return hit.res as Resource<T>
    }
    const retry = opts.retry ?? true
    const seed = opts.slot === undefined ? undefined : slots.get(opts.slot)
    const entry: Entry = {
      res: reactive({
        status: (seed === undefined ? 'loading' : 'success') as ResourceStatus,
        data: seed,
        error: null as unknown,
        refresh: () => entry.run(),
      }),
      settledAt: -Infinity,
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
          if (opts.slot !== undefined) slots.set(opts.slot, value)
          break
        } catch (err) {
          if (gen !== entry.gen) return
          if (retry && shouldRetry(err, attempt)) {
            await sleep(retryDelayMs(attempt))
            if (gen !== entry.gen) return
            continue
          }
          entry.res.error = err
          entry.res.status = entry.res.data === undefined ? 'error' : 'success'
          break
        }
      }
      entry.settledAt = now()
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

  /** Refetch every entry that failed with nothing to show (status 'error'): the Retry of every error state (partials/load-error.html). */
  function retryFailed(): void {
    for (const e of entries.values()) if (e.res.status === 'error' && !e.inFlight) e.res.refresh()
  }

  return { cached, invalidate, retryFailed }
}

export type Cache = ReturnType<typeof createCache>
