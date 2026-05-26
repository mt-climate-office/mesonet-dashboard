import { useQuery } from '@tanstack/react-query'
import { getPptSummary } from '../lib/api'

/** Precipitation summary stats (since-midnight, 24h, 7d, 30d, etc.). */
export function usePptSummary(station: string | null) {
  return useQuery({
    queryKey: ['ppt-summary', station],
    queryFn: () => getPptSummary(station!),
    enabled: !!station,
    staleTime: 30 * 60 * 1000,
  })
}
