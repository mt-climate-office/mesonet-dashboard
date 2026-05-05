import { useQuery } from '@tanstack/react-query'
import { getDerived, getDerivedSoil, type DerivedQuery } from '../lib/api'

/**
 * Fetches a derived dataset for the Ag Tools tab. Mirrors the legacy
 * get_data.get_derived dispatch: soil_temp/soil_ec_blk/soil_vwc go through
 * /observations, the rest through /derived. SWP and percent_saturation come
 * from /derived but the soil heatmap merges them in via {@link getDerivedSoil}.
 */
export function useDerived(query: DerivedQuery | null) {
  return useQuery({
    queryKey: query
      ? [
          'derived',
          query.time,
          query.station,
          query.variable,
          query.start,
          query.end,
          query.crop,
        ]
      : ['derived', 'disabled'],
    queryFn: () => getDerived(query!),
    enabled: !!query && !!query.station && !!query.variable,
  })
}

/**
 * Soil heatmap data. Calls the same endpoint twice (obs + derived percent_saturation/swp)
 * and merges client-side, matching the legacy callback.
 */
export function useDerivedSoil(query: Omit<DerivedQuery, 'crop'> | null) {
  return useQuery({
    queryKey: query
      ? [
          'derived-soil',
          query.time,
          query.station,
          query.variable,
          query.start,
          query.end,
        ]
      : ['derived-soil', 'disabled'],
    queryFn: () => getDerivedSoil(query!),
    enabled: !!query && !!query.station,
  })
}
