/**
 * Plain labels: the one map from a Charts `v=` id (element family or Ag tool,
 * one namespace) to a sentence-case name, its unit and its display precision
 * (REDESIGN.md "Visual language"). Never show an API label where this has
 * one. Pure; the Charts list reads it, and every new surface should.
 */
import { degToCompass } from '../params/latest'

export interface PlainLabel {
  /** Sentence case, plain words: "Humidity", "Sunlight", "Soil salinity (EC)". */
  name: string
  /** Display unit ('' for unitless): °F, %, mph, mb, W/m², in. */
  unit: string
  /** Decimals: `display` for hero, tiles and the list; `table` for tables and tooltips. */
  digits: { display: number; table: number }
  /** A short second line for the Charts list (Ag tools say what they are). */
  sub?: string
}

const d = (display: number, table: number) => ({ display, table })

/** Element families (core/params ELEM_MAP ids) and Ag tools (core/params/ag AG_TOOL_IDS). */
export const LABELS: Readonly<Record<string, PlainLabel>> = {
  // Weather
  air_temp: { name: 'Air temperature', unit: '°F', digits: d(0, 1) },
  rh: { name: 'Humidity', unit: '%', digits: d(0, 1) },
  vpd_atmo: { name: 'Vapor pressure deficit', unit: 'mb', digits: d(1, 2) },
  wind_spd: { name: 'Wind', unit: 'mph', digits: d(0, 1) },
  windgust: { name: 'Wind gusts', unit: 'mph', digits: d(0, 1) },
  wind_dir: { name: 'Wind direction', unit: '°', digits: d(0, 0) },
  sol_rad: { name: 'Sunlight', unit: 'W/m²', digits: d(0, 0) },
  bp: { name: 'Pressure', unit: 'mb', digits: d(0, 1) },
  snow_depth: { name: 'Snow depth', unit: 'in', digits: d(1, 1) },
  // Rain and evaporation (etr is also the Reference ET Ag tool: one id, one label)
  ppt: { name: 'Rain', unit: 'in', digits: d(2, 2) },
  ppt_max_rate: { name: 'Rain rate', unit: 'in/h', digits: d(2, 2) },
  etr: { name: 'Reference ET', unit: 'in', digits: d(2, 3), sub: 'Water use of a reference grass crop' },
  // Soil
  soil_vwc: { name: 'Soil moisture', unit: '%', digits: d(0, 1) },
  soil_temp: { name: 'Soil temperature', unit: '°F', digits: d(0, 1) },
  soil_ec_blk: { name: 'Soil salinity (EC)', unit: 'mS/cm', digits: d(2, 3) },
  // Well
  well_lvl: { name: 'Well water level', unit: 'in', digits: d(1, 1) },
  well_tmp: { name: 'Well water temperature', unit: '°F', digits: d(0, 1) },
  well_eco: { name: 'Well salinity (EC)', unit: 'mS/cm', digits: d(2, 3) },
  // Ag tools
  gdd: { name: 'Growing degree days', unit: 'GDD', digits: d(0, 0), sub: 'Crop heat since a start date' },
  feels_like: { name: 'Feels like', unit: '°F', digits: d(0, 1), sub: 'Wind chill or heat index' },
  cci: { name: 'Livestock risk', unit: '', digits: d(0, 1), sub: 'Cold and heat stress index' },
  'soil_temp,soil_ec_blk': { name: 'Soil profile', unit: '', digits: d(0, 1), sub: 'Every sensor depth over time' },
  swp: { name: 'Soil water potential', unit: 'bar', digits: d(1, 2), sub: 'How hard roots work for water' },
  percent_saturation: { name: 'Soil saturation', unit: '%', digits: d(0, 1), sub: 'Water as a share of pore space' },
  annual: { name: 'Annual comparison', unit: '', digits: d(0, 1), sub: 'This year against past years' },
}

/** The plain name for `id`, else `fallback` (an element the map does not know yet keeps its API name). */
export const plainName = (id: string, fallback: string): string => LABELS[id]?.name ?? fallback

/**
 * `value` at `id`'s precision for `where`, without the unit (for a value set
 * apart from its unit, as on the Now tiles): "54", "0.05", "2,412"; '—' for
 * null or non-finite. Unknown ids show up to 2 decimals.
 */
export function formatValue(id: string, value: number | null | undefined, where: keyof PlainLabel['digits'] = 'display'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const digits = LABELS[id]?.digits[where]
  const n = value.toLocaleString('en-US', digits === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: digits, maximumFractionDigits: digits })
  // Avoid "-0" after rounding a small negative.
  return /^-0(\.0+)?$/.test(n) ? n.slice(1) : n
}

/**
 * `value` in `id`'s unit at its precision for `where`: "54 °F", "8 %",
 * "0.05 in"; '—' for null or non-finite. Thousands are grouped ("2,412 GDD").
 * Unknown ids show the number at up to 2 decimals with no unit.
 */
export function formatReading(id: string, value: number | null | undefined, where: keyof PlainLabel['digits'] = 'display'): string {
  const text = formatValue(id, value, where)
  const unit = LABELS[id]?.unit ?? ''
  return text === '—' || !unit ? text : `${text}${unit === '%' || unit === '°' ? '' : ' '}${unit}`
}

/** API units in plain form ("mi/hr" → "mph", "mbar" → "mb", "deg" → "°", "inches" → "in"); others unchanged. */
export function plainUnit(unit: string): string {
  const map: Record<string, string> = { 'mi/hr': 'mph', 'mi/h': 'mph', mbar: 'mb', deg: '°', inches: 'in', 'in.': 'in', 'in/hr': 'in/h', 'W/m^2': 'W/m²' }
  return map[unit] ?? unit
}

/** 16-point compass word for a direction in degrees ("SSE"); any real angle; '—' for null. */
export function compassWord(deg: number | null | undefined): string {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return '—'
  return degToCompass(((deg % 360) + 360) % 360)
}
