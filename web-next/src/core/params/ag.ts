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
 * Ag tool ids, in list order: in Charts, a `v=` value in this list opens that
 * Ag tool; any other value is an observed variable family (one namespace;
 * core/router). `etr` is both an Ag tool and an element family: the Ag tool
 * wins. Names and one-line descriptions are in core/variables/labels (`LABELS`).
 */
export const AG_TOOL_IDS: readonly string[] = ['etr', 'gdd', 'feels_like', 'cci', 'soil_temp,soil_ec_blk', 'swp', 'percent_saturation', 'annual'] satisfies readonly DerivedVar[]

/** True when `v` is an Ag tool id (`AG_TOOL_IDS`). */
export const isAgTool = (v: string | null | undefined): v is DerivedVar => !!v && AG_TOOL_IDS.includes(v)

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
