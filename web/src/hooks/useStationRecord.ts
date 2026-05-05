import { useQuery } from '@tanstack/react-query'
import { getStationRecord, type RecordQuery } from '../lib/api'

/**
 * Time-series query for a station. Re-runs whenever any input changes — keys
 * are inputs verbatim so navigating "back" hits cache instantly.
 */
export function useStationRecord(query: RecordQuery | null) {
  return useQuery({
    queryKey: query
      ? [
          'observations',
          query.period,
          query.station,
          query.elements,
          query.start,
          query.end,
          query.hasEtr,
          query.derivedElems,
          query.rmNa,
          query.publicOnly,
        ]
      : ['observations', 'disabled'],
    queryFn: () => getStationRecord(query!),
    enabled: !!query && !!query.station,
  })
}
