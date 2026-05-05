/**
 * Constants ported from app/mdb/utils/params.py.
 * Keep in sync with the legacy app's params.py until that app is retired.
 */

export type AggPeriod = 'hourly' | 'daily' | 'monthly' | 'raw'

export const DEFAULT_VARS = [
  'Precipitation',
  'Reference ET',
  'Soil VWC',
  'Air Temperature',
  'Solar Radiation',
  'Soil Temperature',
  'Relative Humidity',
  'Wind Speed',
  'Atmospheric Pressure',
] as const

export const SELECTED_VARS = [
  'Precipitation',
  'Reference ET',
  'Soil VWC',
  'Soil Temperature',
  'Air Temperature',
] as const

/** Map a display variable to one or more element-code prefixes. */
export const ELEM_MAP: Record<string, string[]> = {
  Precipitation: ['ppt'],
  'Reference ET': ['etr'],
  'Soil VWC': ['soil_vwc'],
  'Air Temperature': ['air_temp'],
  'Solar Radiation': ['sol_rad'],
  'Soil Temperature': ['soil_temp'],
  'Relative Humidity': ['rh'],
  'Wind Speed': ['wind_spd', 'wind_dir'],
  'Atmospheric Pressure': ['bp'],
  'Bulk EC': ['soil_ec_blk'],
  'Gust Speed': ['windgust'],
  'Well EC': ['well_eco'],
  'Well Water Level': ['well_lvl'],
  'Well Water Temperature': ['well_tmp'],
  VPD: ['vpd_atmo'],
  'Snow Depth': ['snow_depth'],
  'Max Precip Rate': ['ppt_max_rate'],
  'Wind Direction': ['wind_dir'],
}

/** Display variable → primary line color. */
export const COLOR_MAPPER: Record<string, string | null> = {
  'Air Temperature': '#c42217',
  'Solar Radiation': '#c15366',
  'Relative Humidity': '#a16a5c',
  'Snow Depth': '#A020F0',
  'Wind Speed': '#ec6607',
  'Atmospheric Pressure': '#A020F0',
  'Well Water Level': '#0000FF',
  'Well Water Temperature': '#c42217',
  'Well EC': '#AEF359',
  'Gust Speed': '#FEC20C',
  'Max Precip Rate': '#000080',
  VPD: '#32612D',
  'Wind Direction': '#607D3B',
  'Soil Temperature': null,
  'Soil VWC': null,
  'Bulk EC': null,
  Precipitation: null,
}

export const AXIS_MAPPER: Record<string, string> = {
  Precipitation: 'Precipitation<br>(inches)',
  'Soil VWC': 'Soil VWC<br>(%)',
  'Bulk EC': 'Soil Bulk<br>EC (mS cm⁻¹)',
  'Air Temperature': 'Air Temp.<br>(°F)',
  'Relative Humidity': 'Relative Hum.<br>(%)',
  'Solar Radiation': 'Solar Rad.<br>(W/m²)',
  'Wind Speed': 'Wind Spd.<br>(mph)',
  'Soil Temperature': 'Soil Temp.<br>(°F)',
  'Atmospheric Pressure': 'Atmos. Pres. (mbar)',
  'Reference ET': 'Reference ET<br>(inches)',
  'Snow Depth': 'Snow Depth<br>(in.)',
  'Gust Speed': 'Gust Speed<br>(mi/hr)',
  'Max Precip Rate': 'Max Precip Rate<br>(in/hr)',
  VPD: 'VPD (mbar)',
  'Well Water Level': 'Well Depth<br>(in.)',
  'Well Water Temperature': 'Well Temperature<br>(°F)',
  'Well EC': 'Well EC<br>(mS cm⁻¹)',
  'Wind Direction': 'Wind Direction<br>(deg)',
}

/**
 * Column-name normalisation applied to API responses. Mirrors params.lab_swap.
 * The new API already emits `datetime` (legacy used `index`); the rename is
 * mostly soil depth conversions (cm → inches) and consolidating the multi-
 * height air-temp / wind columns under a single canonical label.
 */
export const LAB_SWAP: Record<string, string> = {
  index: 'datetime',
  'Air Temperature @ 2 m [°F]': 'Air Temperature [°F]',
  'Air Temperature @ 8 ft [°F]': 'Air Temperature [°F]',
  'Soil Temperature @ -10 cm [°F]': 'Soil Temperature @ 4 in [°F]',
  'Soil Temperature @ -70 cm [°F]': 'Soil Temperature @ 28 in [°F]',
  'Soil Temperature @ -100 cm [°F]': 'Soil Temperature @ 40 in [°F]',
  'Soil Temperature @ -20 cm [°F]': 'Soil Temperature @ 8 in [°F]',
  'Soil Temperature @ -5 cm [°F]': 'Soil Temperature @ 2 in [°F]',
  'Soil Temperature @ -50 cm [°F]': 'Soil Temperature @ 20 in [°F]',
  'Soil Temperature @ -91 cm [°F]': 'Soil Temperature @ 36 in [°F]',
  'Soil VWC @ -10 cm [%]': 'Soil VWC @ 4 in [%]',
  'Soil VWC @ -70 cm [%]': 'Soil VWC @ 28 in [%]',
  'Soil VWC @ -100 cm [%]': 'Soil VWC @ 40 in [%]',
  'Soil VWC @ -20 cm [%]': 'Soil VWC @ 8 in [%]',
  'Soil VWC @ -5 cm [%]': 'Soil VWC @ 2 in [%]',
  'Soil VWC @ -50 cm [%]': 'Soil VWC @ 20 in [%]',
  'Soil VWC @ -91 cm [%]': 'Soil VWC @ 36 in [%]',
  'Bulk EC @ -10 cm [mS/cm]': 'Bulk EC @ 4 in [mS/cm]',
  'Bulk EC @ -70 cm [mS/cm]': 'Bulk EC @ 28 in [mS/cm]',
  'Bulk EC @ -100 cm [mS/cm]': 'Bulk EC @ 40 in [mS/cm]',
  'Bulk EC @ -20 cm [mS/cm]': 'Bulk EC @ 8 in [mS/cm]',
  'Bulk EC @ -5 cm [mS/cm]': 'Bulk EC @ 2 in [mS/cm]',
  'Bulk EC @ -50 cm [mS/cm]': 'Bulk EC @ 20 in [mS/cm]',
  'Bulk EC @ -91 cm [mS/cm]': 'Bulk EC @ 36 in [mS/cm]',
  'Soil Water Potential @ -10 cm [bar]': 'Soil Water Potential @ 4 in [bar]',
  'Soil Water Potential @ -70 cm [bar]': 'Soil Water Potential @ 28 in [bar]',
  'Soil Water Potential @ -100 cm [bar]': 'Soil Water Potential @ 40 in [bar]',
  'Soil Water Potential @ -20 cm [bar]': 'Soil Water Potential @ 8 in [bar]',
  'Soil Water Potential @ -5 cm [bar]': 'Soil Water Potential @ 2 in [bar]',
  'Soil Water Potential @ -50 cm [bar]': 'Soil Water Potential @ 20 in [bar]',
  'Soil Water Potential @ -91 cm [bar]': 'Soil Water Potential @ 36 in [bar]',
  'Percent Saturation @ -10 cm [%]': 'Percent Saturation @ 4 in [%]',
  'Percent Saturation @ -70 cm [%]': 'Percent Saturation @ 28 in [%]',
  'Percent Saturation @ -100 cm [%]': 'Percent Saturation @ 40 in [%]',
  'Percent Saturation @ -20 cm [%]': 'Percent Saturation @ 8 in [%]',
  'Percent Saturation @ -5 cm [%]': 'Percent Saturation @ 2 in [%]',
  'Percent Saturation @ -50 cm [%]': 'Percent Saturation @ 20 in [%]',
  'Percent Saturation @ -91 cm [%]': 'Percent Saturation @ 36 in [%]',
  'Wind Direction @ 10 m [deg]': 'Wind Direction [deg]',
  'Wind Direction @ 8 ft [deg]': 'Wind Direction [deg]',
  'Wind Speed @ 10 m [mi/hr]': 'Wind Speed [mi/hr]',
  'Wind Speed @ 8 ft [mi/hr]': 'Wind Speed [mi/hr]',
  'Gust Speed @ 8 ft [mi/hr]': 'Gust Speed [mi/hr]',
  'Gust Speed @ 10 m [mi/hr]': 'Gust Speed [mi/hr]',
  'Wind Speed @ 10 m [mi/h]': 'Wind Speed [mi/hr]',
  'Wind Speed @ 8 ft [mi/h]': 'Wind Speed [mi/hr]',
  'Gust Speed @ 8 ft [mi/h]': 'Gust Speed [mi/hr]',
  'Gust Speed @ 10 m [mi/h]': 'Gust Speed [mi/hr]',
}

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

export const WIND_DIRECTIONS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const

/**
 * Convert a degree (0-360) to one of the 16 compass points.
 * Mirrors plotting.deg_to_compass.
 */
export function degToCompass(deg: number): string {
  const ix = Math.round(deg / 22.5) % 16
  return WIND_DIRECTIONS[ix]
}

/**
 * Variables whose aggregation is "sum" rather than "mean" (precipitation, ET).
 * Used when grouping observations by month.
 */
export const SUM_AGGREGATED = new Set([
  'Precipitation [in]',
  'Reference ET (a=0.23) [in]',
])

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

/** Crop → [base, max] temperature thresholds, °F. */
export const GDD_CROP_THRESHOLDS: Record<string, [number, number]> = {
  canola: [41, 100],
  corn: [50, 86],
  sunflower: [44, 100],
  wheat: [32, 95],
  barley: [32, 95],
  sugarbeet: [34, 86],
  hemp: [34, 100],
}

export const SOIL_VAR_OPTIONS: { value: string; label: string }[] = [
  { value: 'soil_blk_ec', label: 'Electrical Conductivity' },
  { value: 'soil_vwc', label: 'Volumetric Water Content' },
  { value: 'soil_temp', label: 'Temperature' },
  { value: 'swp', label: 'Soil Water Potential' },
  { value: 'percent_saturation', label: 'Percent Saturation' },
]

/* -------------------------------------------------------------------------- */
/* CVD-accessible palettes — perceptually uniform sequential and CVD-safe     */
/* qualitative. Inline so the rest of the app pulls the same swatches and we  */
/* don't ship a colormap library just for these.                              */
/* -------------------------------------------------------------------------- */

/**
 * Tol's "Muted" qualitative palette — 9 colors, distinguishable under all
 * three common CVD types (deuteranopia, protanopia, tritanopia) and in
 * grayscale. https://personal.sron.nl/~pault/
 */
export const PALETTE_QUAL_TOL_MUTED = [
  '#332288', // indigo
  '#117733', // green
  '#44AA99', // teal
  '#88CCEE', // light blue
  '#DDCC77', // sand
  '#CC6677', // rose
  '#AA4499', // purple
  '#882255', // wine
  '#999933', // olive
] as const

/** Tol's "Bright" qualitative — 7 high-contrast CVD-safe colors. */
export const PALETTE_QUAL_TOL_BRIGHT = [
  '#4477AA', // blue
  '#EE6677', // red
  '#228833', // green
  '#CCBB44', // yellow
  '#66CCEE', // cyan
  '#AA3377', // purple
  '#BBBBBB', // gray
] as const

/**
 * 8-stop discrete sample of Viridis (perceptually uniform sequential, CVD-
 * safe, grayscale-safe). Use for ordered/sequential data where higher values
 * map to brighter colors.
 */
export const PALETTE_VIRIDIS = [
  '#440154',
  '#46327E',
  '#365C8D',
  '#277F8E',
  '#1FA187',
  '#4AC16D',
  '#9FDA3A',
  '#FDE725',
] as const

/**
 * 7-stop ColorBrewer YlOrRd — sequential, CVD-safe, ordered light → dark.
 * Use where higher = more intense / more dangerous.
 */
export const PALETTE_YLORRD_7 = [
  '#FFFFCC',
  '#FFEDA0',
  '#FED976',
  '#FEB24C',
  '#FD8D3C',
  '#FC4E2A',
  '#E31A1C',
  '#BD0026',
  '#800026',
] as const

/**
 * Pick `n` evenly-spaced samples from a continuous palette.
 * Returns `n` colors interpolated between the existing stops (linear in RGB).
 */
export function sampleSequential(palette: readonly string[], n: number): string[] {
  if (n <= 0) return []
  if (n === 1) return [palette[0]]
  const result: string[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const idx = t * (palette.length - 1)
    const lo = Math.floor(idx)
    const hi = Math.min(palette.length - 1, lo + 1)
    const frac = idx - lo
    result.push(lerpHex(palette[lo], palette[hi], frac))
  }
  return result
}

function lerpHex(a: string, b: string, t: number): string {
  const ra = parseInt(a.slice(1, 3), 16)
  const ga = parseInt(a.slice(3, 5), 16)
  const ba = parseInt(a.slice(5, 7), 16)
  const rb = parseInt(b.slice(1, 3), 16)
  const gb = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ra + (rb - ra) * t)
  const g = Math.round(ga + (gb - ga) * t)
  const c = Math.round(ba + (bb - ba) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${c.toString(16).padStart(2, '0')}`.toUpperCase()
}

/**
 * Color palette for soil-depth lines. Sampled from Viridis so colors carry
 * the natural shallow→deep ordering visually, and are CVD/grayscale safe.
 */
export const SOIL_DEPTH_COLOR: Record<string, string> = (() => {
  const depths = ['2 in', '4 in', '8 in', '20 in', '28 in', '36 in', '40 in']
  const colors = sampleSequential(PALETTE_VIRIDIS, depths.length)
  const out: Record<string, string> = {}
  depths.forEach((d, i) => {
    out[d] = colors[i]
  })
  return out
})()

/**
 * GDD growth-stage markers. Categorical CVD-safe palette repeated to cover
 * crops with many stages.
 */
export const GDD_STAGE_COLORS: string[] = [
  ...PALETTE_QUAL_TOL_MUTED,
  ...PALETTE_QUAL_TOL_BRIGHT,
]

/**
 * Livestock CCI risk classes → marker colors.
 *
 * Risk is ordered (No Stress → Extreme Danger), so we use a CVD-safe
 * sequential palette (ColorBrewer YlOrRd) with a neutral gray for "no
 * stress". Light → dark traces the cold-stress risk gradient on the Comfort
 * Climate Index, matching the colorblind-safe ramps in `PALETTE_YLORRD_7`.
 */
export const CCI_RISK_COLORS: Record<string, string> = {
  'No Stress': '#BBBBBB',
  Mild: '#FED976',
  Moderate: '#FD8D3C',
  Severe: '#E31A1C',
  Extreme: '#BD0026',
  'Extreme Danger': '#800026',
}

/* -------------------------------------------------------------------------- */
/* Satellite constants — ported from params.py for the (currently-disabled)   */
/* satellite tab. Kept here so the UI shell can render even though we have    */
/* no live data source.                                                      */
/* -------------------------------------------------------------------------- */

export const SATELLITE_VARS = ['ET', 'EVI', 'Fpar', 'GPP', 'LAI', 'NDVI', 'PET'] as const
export type SatelliteVar = (typeof SATELLITE_VARS)[number]

export const SATELLITE_VAR_LABELS: Record<SatelliteVar, string> = {
  ET: 'ET',
  EVI: 'EVI',
  Fpar: 'FPAR',
  GPP: 'GPP',
  LAI: 'LAI',
  NDVI: 'NDVI',
  PET: 'PET',
}

export const SAT_AXIS_MAPPER: Record<string, string> = {
  GPP: 'GPP (g C m⁻²)',
  ET: 'ET (mm day⁻¹)',
  PET: 'PET (mm day⁻¹)',
  Fpar: 'FPAR',
  NDVI: 'NDVI',
  EVI: 'EVI',
  LAI: 'LAI',
}

/** Compare dropdown — keys are display labels, values match legacy `compare1` opts. */
export const SAT_COMPARE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ET-MYD16A2.061', label: 'ET (MODIS Aqua)' },
  { value: 'ET-MOD16A2.061', label: 'ET (MODIS Terra)' },
  { value: 'PET-MYD16A2.061', label: 'PET (MODIS Aqua)' },
  { value: 'PET-MOD16A2.061', label: 'PET (MODIS Terra)' },
  { value: 'GPP-MYD17A2H.061', label: 'GPP (MODIS Aqua)' },
  { value: 'GPP-MOD17A2H.061', label: 'GPP (MODIS Terra)' },
  { value: 'GPP-SPL4CMDL.006', label: 'GPP (SMAP L4C)' },
  { value: 'Fpar-MYD15A2H.061', label: 'FPAR (MODIS Aqua)' },
  { value: 'Fpar-MOD15A2H.061', label: 'FPAR (MODIS Terra)' },
  { value: 'NDVI-MYD13A1.061', label: 'NDVI (MODIS Aqua)' },
  { value: 'NDVI-MOD13A1.061', label: 'NDVI (MODIS Terra)' },
  { value: 'NDVI-VNP13A1.001', label: 'NDVI (VIIRS)' },
  { value: 'EVI-MYD13A1.061', label: 'EVI (MODIS Aqua)' },
  { value: 'EVI-MOD13A1.061', label: 'EVI (MODIS Terra)' },
  { value: 'EVI-VNP13A1.001', label: 'EVI (VIIRS)' },
  { value: 'LAI-MYD15A2H.061', label: 'LAI (MODIS Aqua)' },
  { value: 'LAI-MOD15A2H.061', label: 'LAI (MODIS Terra)' },
]
