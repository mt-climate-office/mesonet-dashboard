import { useQuery } from '@tanstack/react-query'
import { getStationConfig } from '../lib/api'

/** Sensor-deployment history for a station. */
export function useStationConfig(station: string | null) {
  return useQuery({
    queryKey: ['config', station],
    queryFn: () => getStationConfig(station!),
    enabled: !!station,
    staleTime: 30 * 60 * 1000,
  })
}
