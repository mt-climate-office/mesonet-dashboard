import { useQuery } from '@tanstack/react-query'
import { getStationElements } from '../lib/api'

/**
 * Element catalog filtered to a specific station. `publicOnly` is optional;
 * when omitted the request (and cache key) is unchanged from before, so
 * existing callers keep sharing one cache entry.
 */
export function useStationElements(station: string | null, publicOnly?: boolean) {
  return useQuery({
    queryKey:
      publicOnly === undefined
        ? ['elements', station]
        : ['elements', station, { public: publicOnly }],
    queryFn: () => getStationElements(station!, publicOnly),
    enabled: !!station,
  })
}
