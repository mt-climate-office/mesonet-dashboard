/* -------------------------------------------------------------------------- */
/* Ag Tools constants — ported from app/mdb/utils/params.py + plot_derived.py */
/* -------------------------------------------------------------------------- */

export type DerivedVar =
  | 'etr'
  | 'feels_like'
  | 'gdd'
  | 'soil_temp,soil_ec_blk'
  | 'annual'
  | 'cci'
  | 'swp'
  | 'percent_saturation'

/**
 * The Ag tools, in tool-card order: the `var` value, the name (card title,
 * variable select, chart heading) and the one-line card description.
 */
export const DERIVED_VAR_OPTIONS: { value: DerivedVar; label: string; description: string }[] = [
  { value: 'etr', label: 'Reference ET', description: 'Daily or hourly water use of a reference grass crop (ETr), with the running total.' },
  { value: 'gdd', label: 'Growing degree days', description: 'Heat accumulated since the start date for a crop, with growth stages and a projection.' },
  { value: 'feels_like', label: 'Feels like', description: 'How cold or hot it feels: NWS wind chill or heat index.' },
  { value: 'cci', label: 'Livestock risk', description: 'Comprehensive Climate Index (CCI) stress classes for adult or newborn livestock.' },
  { value: 'soil_temp,soil_ec_blk', label: 'Soil profile', description: 'Soil moisture, temperature or conductivity at every sensor depth over time.' },
  { value: 'swp', label: 'Soil water potential', description: 'How hard roots work for water at each depth, against field capacity and wilting point.' },
  { value: 'percent_saturation', label: 'Percent saturation', description: 'Soil water content as a share of the pore space at each depth.' },
  { value: 'annual', label: 'Annual comparison', description: 'This year against past years for any variable the station reports.' },
]

export const GDD_CROPS: { value: string; label: string }[] = [
  { value: 'wheat', label: 'Wheat' },
  { value: 'barley', label: 'Barley' },
  { value: 'canola', label: 'Canola' },
  { value: 'corn', label: 'Corn' },
  { value: 'sunflower', label: 'Sunflower' },
  { value: 'sugarbeet', label: 'Sugarbeet' },
  { value: 'hemp', label: 'Hemp' },
]

// Crop GDD cutoffs live in the compute library (`core/ag/compute/gdd.ts`
// `GDD_CUTOFFS_F`, verbatim from the API incl. the wheat/barley NDAWN switch).
// The legacy slider table (wheat/barley 32–95, hemp 34–100, sunflower 44–100)
// disagreed with what the API computes and was removed in Wave 3.

export const SOIL_VAR_OPTIONS: { value: string; label: string }[] = [
  { value: 'soil_blk_ec', label: 'Electrical Conductivity' },
  { value: 'soil_vwc', label: 'Volumetric Water Content' },
  { value: 'soil_temp', label: 'Temperature' },
  { value: 'swp', label: 'Soil Water Potential' },
  { value: 'percent_saturation', label: 'Percent Saturation' },
]
