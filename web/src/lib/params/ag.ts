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

export const DERIVED_VAR_OPTIONS: { value: DerivedVar; label: string }[] = [
  { value: 'etr', label: 'Reference ET' },
  { value: 'feels_like', label: 'Feels Like Temperature' },
  { value: 'gdd', label: 'Growing Degree Days' },
  { value: 'soil_temp,soil_ec_blk', label: 'Soil Profile Plot' },
  { value: 'annual', label: 'Annual Comparison Plot' },
  { value: 'cci', label: 'Livestock Risk Index' },
  { value: 'swp', label: 'Soil Water Potential' },
  { value: 'percent_saturation', label: 'Percent Soil Saturation' },
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

// Crop GDD cutoffs live in the compute library (`features/ag/compute/gdd.ts`
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
