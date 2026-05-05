import { useQuery } from '@tanstack/react-query'
import { getStations } from '../lib/api'

/** Master station catalog. Fetched once, cached aggressively. */
export function useStations() {
  return useQuery({
    queryKey: ['stations'],
    queryFn: getStations,
    staleTime: 60 * 60 * 1000, // 1h — station list changes slowly
  })
}
