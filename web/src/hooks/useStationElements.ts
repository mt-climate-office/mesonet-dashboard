import { useQuery } from '@tanstack/react-query'
import { getStationElements } from '../lib/api'

/** Element catalog filtered to a specific station. */
export function useStationElements(station: string | null) {
  return useQuery({
    queryKey: ['elements', station],
    queryFn: () => getStationElements(station!),
    enabled: !!station,
  })
}
