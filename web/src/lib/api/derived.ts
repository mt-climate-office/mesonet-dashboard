/* -------------------------------------------------------------------------- */
/* Ag Tools — derived endpoints                                               */
/* -------------------------------------------------------------------------- */
import { fetchCsv, mergeOn } from './http'
import { exclusiveEnd } from './record'
import type { ObservationRow } from './types'

export interface DerivedQuery {
  station: string
  variable: string
  /** YYYY-MM-DD */
  start: string
  /** YYYY-MM-DD */
  end: string
  /** 'daily' | 'hourly' */
  time: 'daily' | 'hourly'
  /** Crop name for GDD; ignored otherwise. */
  crop?: string
}

/**
 * Fetch derived/observation series for the Ag Tools tab.
 * Mirrors get_data.get_derived from the legacy app.
 *
 * - Soil variables (soil_temp, soil_ec_blk, soil_vwc) hit /observations/{time}.
 * - Everything else (etr, gdd, feels_like, cci, swp, percent_saturation) hits /derived/{time}.
 *
 * Note on GDD: the new RDS API ignores `low`/`high` query params (verified
 * empirically against /derived/daily). The slider in the UI therefore drives
 * client-side recomputation in DerivedChart from the Tmax/Tmin columns the
 * API returns when `keep=true` is set. We send `keep=true` only for `gdd`
 * since other endpoints don't honor it (and it makes the response wider).
 */
export async function getDerived(q: DerivedQuery): Promise<ObservationRow[]> {
  const isObservation =
    q.variable.includes('soil_temp') ||
    q.variable.includes('soil_ec_blk') ||
    q.variable.includes('soil_vwc')
  const path = isObservation
    ? `observations/${q.time}`
    : `derived/${q.time}`

  const baseQuery: Record<string, unknown> = {
    stations: q.station,
    start_time: q.start,
    end_time: exclusiveEnd(q.end),
    elements: q.variable,
    rm_na: true,
  }
  if (!isObservation) baseQuery.alpha = 0.23
  if (q.crop) baseQuery.crop = q.crop
  // `keep=true` returns the underlying inputs alongside the derived value.
  // For GDD we use it to recompute against the slider thresholds; for
  // feels_like it surfaces Wind Chill / Heat Index so the chart can color
  // each marker by which regime the value came from.
  if (q.variable === 'gdd' || q.variable === 'feels_like') baseQuery.keep = true

  return fetchCsv<ObservationRow>(path, baseQuery)
}

/**
 * Convenience for the Soil Profile plot. Fetches the soil observation series
 * (temp/EC/VWC) and merges with the derived percent_saturation + swp series so
 * the heatmap can switch between any of the five soil sub-variables without
 * refetching.
 */
export async function getDerivedSoil(q: Omit<DerivedQuery, 'crop'>): Promise<ObservationRow[]> {
  const [obs, derived] = await Promise.all([
    getDerived({ ...q, variable: q.variable }),
    getDerived({ ...q, variable: 'percent_saturation,swp' }),
  ])
  return mergeOn(obs, derived, ['station', 'datetime'])
}
