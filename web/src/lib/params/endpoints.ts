/** API endpoint paths keyed by aggregation period. */

export type AggPeriod = 'hourly' | 'daily' | 'monthly' | 'raw'

/** Period → observations endpoint path. */
export const ENDPOINTS: Record<AggPeriod, string> = {
  hourly: 'observations/hourly',
  daily: 'observations/daily',
  monthly: 'observations/daily',
  raw: 'observations',
}

export const DERIVED_ENDPOINTS: Record<AggPeriod, string> = {
  hourly: 'derived/hourly',
  daily: 'derived/daily',
  monthly: 'derived/daily',
  raw: 'derived/hourly',
}
