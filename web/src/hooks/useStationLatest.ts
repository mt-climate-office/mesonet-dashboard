import { useQuery } from '@tanstack/react-query'
import { getStationLatest } from '../lib/api'

/** Most-recent observation for a station. */
export function useStationLatest(station: string | null) {
  return useQuery({
    queryKey: ['latest', station],
    queryFn: () => getStationLatest(station!),
    enabled: !!station,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  })
}
