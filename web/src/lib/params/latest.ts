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

/** Y-axis titles, verbatim from legacy params.axis_mapper. */
export const AXIS_MAPPER: Record<string, string> = {
  Precipitation: 'Precipitation<br>(inches)',
  'Soil VWC': 'Soil VWC.<br>(%)',
  'Bulk EC': 'Soil Bulk<br>EC (mS cm<sup>-1</sup>)',
  'Air Temperature': 'Air Temp.<br>(°F)',
  'Relative Humidity': 'Relative Hum.<br>(%)',
  'Solar Radiation': 'Solar Rad.<br>(W/m<sup>2</sup>)',
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
  'Well EC': 'Well EC<br>(mS cm<sup>-1</sup>)',
  'Wind Direction': 'Wind Direction<br>(deg)',
}

/**
 * Y-axis title for a Latest panel. Precipitation / Reference ET get a
 * per-period unit (legacy plot_site): daily "(inches/day)", hourly
 * "(inches/hour)"; raw keeps Precipitation "(inches)" but ETr is
 * "(inches/hour)" (raw ETr comes from /derived/hourly). Unknown variables
 * fall back to the variable name.
 */
export function latestAxisTitle(v: string, period: 'hourly' | 'daily' | 'raw'): string {
  const title = AXIS_MAPPER[v] ?? v
  if (v !== 'Precipitation' && v !== 'Reference ET') return title
  if (period === 'daily') return title.replace('(inches)', '(inches/day)')
  if (period === 'hourly') return title.replace('(inches)', '(inches/hour)')
  if (v === 'Reference ET') return title.replace('(inches)', '(inches/hour)')
  return title
}

/**
 * Element codes never offered on the Latest tab. `ppt_corrected`
 * ("Precipitation (fill-corrected)") is a mesonet2-only element; the default
 * merged `ppt` is already wind-corrected at QC level 2 (DIVERGENCES.md).
 */
export const LATEST_EXCLUDED_ELEMENTS: ReadonlySet<string> = new Set(['ppt_corrected'])

/** Display-variable name of an element: its description_short before "@". */
export const latestVarName = (descriptionShort: string): string =>
  descriptionShort.split('@')[0].trim()

/**
 * Variable chips for a station (legacy update_select_vars): each element's
 * description_short before "@", deduped, plus "Reference ET", sorted.
 */
export function latestVarsFromElements(
  elements: ReadonlyArray<{ element: string; description_short: string }>,
): string[] {
  const out = new Set<string>()
  for (const e of elements) {
    if (LATEST_EXCLUDED_ELEMENTS.has(e.element)) continue
    const name = latestVarName(String(e.description_short ?? ''))
    if (name) out.add(name)
  }
  out.add('Reference ET')
  return [...out].sort()
}

/**
 * Element codes to request for the selected display variables (Reference ET
 * excluded; it rides on `hasEtr`). Known variables use ELEM_MAP prefixes (the
 * API expands `soil_vwc` to every depth). A variable missing from ELEM_MAP
 * falls back to the station's elements with that description_short, so new
 * API elements plot without a code change. With the station's element list,
 * prefixes the station doesn't report are dropped.
 */
export function latestElementCodes(
  vars: readonly string[],
  stationElements?: ReadonlyArray<{ element: string; description_short: string }>,
): string[] {
  const codes = new Set<string>()
  for (const v of vars) {
    if (v === 'Reference ET') continue
    const prefixes = ELEM_MAP[v]
    if (prefixes) {
      for (const p of prefixes) codes.add(p)
    } else if (stationElements) {
      for (const e of stationElements) {
        if (LATEST_EXCLUDED_ELEMENTS.has(e.element)) continue
        if (latestVarName(String(e.description_short ?? '')) === v) codes.add(e.element)
      }
    }
  }
  if (!stationElements || codes.size === 0) return [...codes]
  const have = stationElements.map((r) => r.element)
  const filtered = [...codes].filter((c) =>
    have.some((h) => h === c || h.startsWith(`${c}_`)),
  )
  return filtered.length > 0 ? filtered : [...codes]
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
  // Legacy int(num / 22.5 + 0.5): same float arithmetic, so boundary values
  // land in the same sector.
  const ix = Math.trunc(deg / 22.5 + 0.5) % 16
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
