/**
 * Latest Data tab constants: display variables, element-code map, colors,
 * axis labels, wind-direction helpers, and sum-aggregated columns.
 * Ported from app/mdb/utils/params.py; keep in sync until that app retires.
 */

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
