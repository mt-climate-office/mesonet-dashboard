import { useQuery } from '@tanstack/react-query'
import { getPhotoCatalog, type PhotoMeta } from '../lib/api'

/**
 * Catalog of every station that has cameras, with each station's install
 * date and supported directions. Cached for an hour since the metadata
 * changes only when stations come online or get new sensors.
 *
 * The `/photos/` endpoint is backed by a Lambda that pulls camera metadata
 * from AirTable, and the cold path 503s for the first few requests until
 * the AirTable token is cached. We keep retrying through the warm-up
 * window — empirically 3-5 attempts is plenty.
 */
export function usePhotoCatalog() {
  return useQuery<PhotoMeta[]>({
    queryKey: ['photo-catalog'],
    queryFn: getPhotoCatalog,
    staleTime: 60 * 60 * 1000,
    // Override the global query retry — this endpoint is known-flaky on
    // cold start. 6 attempts × ~500 ms = 3 s of patience covers the typical
    // warm-up.
    retry: (failureCount, error) => {
      const msg = (error as Error)?.message ?? ''
      if (/HTTP 4\d\d/.test(msg)) return false
      return failureCount < 6
    },
    retryDelay: (attempt) => Math.min(500 * (attempt + 1), 3000),
  })
}
