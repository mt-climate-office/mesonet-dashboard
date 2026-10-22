/**
 * Plain labels: the one map from a Charts `v=` id (element family or Ag tool,
 * one namespace) to a sentence-case name, its unit and its display precision
 * (DESIGN.md "Visual language"). Never show an API label where this has
 * one. Pure; the Charts list reads it, and every new surface should. Values
 * passed in are US (the data's units); the formatters convert to the display
 * units (core/units) along with the unit text.
 */
import { degToCompass } from '../params/latest'
import { type Quantity, type Units, digitsFor, fromUs, unitLabel, units } from '../units'

export interface PlainLabel {
  /** Sentence case, plain words: "Humidity", "Sunlight", "Soil salinity (EC)". */
  name: string
  /** US display unit ('' for unitless): °F, %, mph, mb, W/m², in. Read through `labelUnit`. */
  unit: string
  /** Decimals (US): `display` for hero, tiles and the list; `table` for tables and tooltips. */
  digits: { display: number; table: number }
  /** The quantity, when the unit has an SI form (core/units). */
  q?: Quantity
  /** The SI unit text when it is not the quantity's own (GDD). */
  unitSi?: string
  /** A short second line for the Charts list (Ag tools say what they are). */
  sub?: string
}

const d = (display: number, table: number) => ({ display, table })

/** Element families (core/params ELEM_MAP ids) and Ag tools (core/params/ag AG_TOOL_IDS). */
export const LABELS: Readonly<Record<string, PlainLabel>> = {
  // Weather
  air_temp: { name: 'Air temperature', unit: '°F', digits: d(0, 1), q: 'temp' },
  rh: { name: 'Humidity', unit: '%', digits: d(0, 1) },
  vpd_atmo: { name: 'Vapor pressure deficit', unit: 'mb', digits: d(1, 2), q: 'pressure' },
  wind_spd: { name: 'Wind', unit: 'mph', digits: d(0, 1), q: 'speed' },
  windgust: { name: 'Wind gusts', unit: 'mph', digits: d(0, 1), q: 'speed' },
  wind_dir: { name: 'Wind direction', unit: '°', digits: d(0, 0) },
  sol_rad: { name: 'Sunlight', unit: 'W/m²', digits: d(0, 0) },
  bp: { name: 'Pressure', unit: 'mb', digits: d(0, 1), q: 'pressure' },
  snow_depth: { name: 'Snow depth', unit: 'in', digits: d(1, 1), q: 'snow' },
  // Precipitation and evaporation (etr is also the Reference ET Ag tool: one id, one label)
  ppt: { name: 'Precipitation', unit: 'in', digits: d(2, 2), q: 'precip' },
  ppt_max_rate: { name: 'Precipitation rate', unit: 'in/h', digits: d(2, 2), q: 'rate' },
  etr: { name: 'Reference ET', unit: 'in', digits: d(2, 3), q: 'precip', sub: 'Water use of a reference grass crop' },
  // Soil
  soil_vwc: { name: 'Soil moisture', unit: '%', digits: d(0, 1) },
  soil_temp: { name: 'Soil temperature', unit: '°F', digits: d(0, 1), q: 'temp' },
  soil_ec_blk: { name: 'Soil salinity (EC)', unit: 'mS/cm', digits: d(2, 3) },
  // Well
  well_lvl: { name: 'Well water level', unit: 'in', digits: d(1, 1), q: 'precip' },
  well_tmp: { name: 'Well water temperature', unit: '°F', digits: d(0, 1), q: 'temp' },
  well_eco: { name: 'Well salinity (EC)', unit: 'mS/cm', digits: d(2, 3) },
  // Ag tools
  gdd: { name: 'Growing degree days', unit: 'GDD', digits: d(0, 0), q: 'tempDelta', unitSi: 'GDD (°C)', sub: 'Crop heat since a start date' },
  feels_like: { name: 'Feels like', unit: '°F', digits: d(0, 1), q: 'temp', sub: 'Wind chill or heat index' },
  cci: { name: 'Livestock risk', unit: '', digits: d(0, 1), sub: 'Cold and heat stress index' },
  'soil_temp,soil_ec_blk': { name: 'Soil profile', unit: '', digits: d(0, 1), sub: 'Every sensor depth over time' },
  swp: { name: 'Soil water potential', unit: 'bar', digits: d(1, 2), q: 'swp', sub: 'How hard roots work for water' },
  percent_saturation: { name: 'Soil saturation', unit: '%', digits: d(0, 1), sub: 'Water as a share of pore space' },
  annual: { name: 'Annual comparison', unit: '', digits: d(0, 1), sub: 'This year against past years' },
}

/** The plain name for `id`, else `fallback` (an element the map does not know yet keeps its API name). */
export const plainName = (id: string, fallback: string): string => LABELS[id]?.name ?? fallback

/** `id`'s unit text in `u` ("°F" / "°C", "GDD" / "GDD (°C)"); '' for unknown or unitless. */
export function labelUnit(id: string, u: Units = units()): string {
  const l = LABELS[id]
  if (!l) return ''
  if (u !== 'si' || !l.q) return l.unit
  return l.unitSi ?? unitLabel(l.q, u)
}

/** A US value of `id` in `u` (unchanged without an SI form). */
export function labelValue(id: string, value: number, u: Units = units()): number {
  const q = LABELS[id]?.q
  return q ? fromUs(q, value, u) : value
}

/**
 * `value` at `id`'s precision for `where`, without the unit (for a value set
 * apart from its unit, as on the Now tiles): "54", "0.05", "2,412"; '—' for
 * null or non-finite. Unknown ids show up to 2 decimals.
 */
export function formatValue(id: string, value: number | null | undefined, where: keyof PlainLabel['digits'] = 'display', u: Units = units()): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const l = LABELS[id]
  const usDigits = l?.digits[where]
  const digits = usDigits !== undefined && l?.q ? digitsFor(l.q, usDigits, u) : usDigits
  const n = labelValue(id, value, u).toLocaleString('en-US', digits === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: digits, maximumFractionDigits: digits })
  // Avoid "-0" after rounding a small negative.
  return /^-0(\.0+)?$/.test(n) ? n.slice(1) : n
}

/**
 * `value` in `id`'s unit at its precision for `where`: "54 °F", "8 %",
 * "0.05 in"; '—' for null or non-finite. Thousands are grouped ("2,412 GDD").
 * Unknown ids show the number at up to 2 decimals with no unit.
 */
export function formatReading(id: string, value: number | null | undefined, where: keyof PlainLabel['digits'] = 'display', u: Units = units()): string {
  const text = formatValue(id, value, where, u)
  const unit = labelUnit(id, u)
  return text === '—' || !unit ? text : `${text}${unit === '%' || unit === '°' ? '' : ' '}${unit}`
}

/**
 * A chart's y-axis title: the plain name and unit ("Air temperature (°F)",
 * "Soil moisture (%)", "Wind direction (°)"); the name alone without a unit.
 * An id the map does not know keeps `fallback`.
 */
export function axisTitle(id: string, fallback: string, u: Units = units()): string {
  const l = LABELS[id]
  if (!l) return fallback
  const unit = labelUnit(id, u)
  return unit ? `${l.name} (${unit})` : l.name
}

/** The running-total form of an axis title: "Precipitation (in)" → "Cumulative precipitation (in)". */
export const cumulativeTitle = (title: string): string => `Cumulative ${title.charAt(0).toLowerCase()}${title.slice(1)}`

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
