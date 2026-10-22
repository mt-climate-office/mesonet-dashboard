/**
 * Display units: US (the API default, and every value the app fetches and computes on) or SI
 * (the API's `units=si`). Data stays US everywhere; display edges convert with `fromUs` and
 * label with `unitLabel`. The active system comes from an injected reader (main.ts: `?units=`),
 * so a reactive getter that formats a value re-runs when it changes; tests and core default to US.
 */
import { MM_PER_IN, MS_PER_MPH } from './ag/compute/units'
import type { StorageLike } from './stations/recent'

export const UNITS = ['us', 'si'] as const
export type Units = (typeof UNITS)[number]

let reader: () => Units = () => 'us'

/** Point `units()` at the app's setting (main.ts, once, before the stores start). */
export function setUnitsSource(read: () => Units): void {
  reader = read
}

/** The active display units. */
export const units = (): Units => reader()

/** The menu's name for `u`: "US" or "Metric". */
export const unitsName = (u: Units): string => (u === 'si' ? 'Metric' : 'US')

/** What a download in `u` contains: "US (°F, in, mph)" / "Metric (°C, mm, m/s)". */
export const unitsFileText = (u: Units): string => (u === 'si' ? 'Metric (°C, mm, m/s)' : 'US (°F, in, mph)')

/** True when values show in SI. */
export const isSi = (u: Units = units()): boolean => u === 'si'

/** Quantities with a US and an SI form (the API's `us_units` / `base_units`). */
export type Quantity =
  | 'temp' // °F ↔ °C
  | 'tempDelta' // °F difference ↔ °C difference (degree days)
  | 'precip' // in ↔ mm (precipitation, ET, well level)
  | 'snow' // in ↔ cm
  | 'rate' // in/h ↔ mm/h
  | 'speed' // mph ↔ m/s
  | 'pressure' // mb ↔ kPa (pressure, VPD)
  | 'swp' // bar ↔ kPa (soil water potential)
  | 'elev' // ft ↔ m

interface QuantitySpec {
  us: string
  si: string
  /** US value → SI value. */
  toSi: (v: number) => number
  /** SI value → US value. */
  toUs: (v: number) => number
  /** Extra decimals SI needs to keep US precision (mm vs in: fewer; m/s, kPa: more). */
  siDigits: number
}

const FT_PER_M = 1 / 0.3048

const SPECS: Record<Quantity, QuantitySpec> = {
  temp: { us: '°F', si: '°C', toSi: (f) => ((f - 32) * 5) / 9, toUs: (c) => (c * 9) / 5 + 32, siDigits: 0 },
  tempDelta: { us: '°F', si: '°C', toSi: (f) => (f * 5) / 9, toUs: (c) => (c * 9) / 5, siDigits: 0 },
  precip: { us: 'in', si: 'mm', toSi: (v) => v * MM_PER_IN, toUs: (v) => v / MM_PER_IN, siDigits: -1 },
  snow: { us: 'in', si: 'cm', toSi: (v) => v * 2.54, toUs: (v) => v / 2.54, siDigits: 0 },
  rate: { us: 'in/h', si: 'mm/h', toSi: (v) => v * MM_PER_IN, toUs: (v) => v / MM_PER_IN, siDigits: -1 },
  speed: { us: 'mph', si: 'm/s', toSi: (v) => v * MS_PER_MPH, toUs: (v) => v / MS_PER_MPH, siDigits: 1 },
  pressure: { us: 'mb', si: 'kPa', toSi: (v) => v / 10, toUs: (v) => v * 10, siDigits: 1 },
  swp: { us: 'bar', si: 'kPa', toSi: (v) => v * 100, toUs: (v) => v / 100, siDigits: -1 },
  elev: { us: 'ft', si: 'm', toSi: (v) => v / FT_PER_M, toUs: (v) => v * FT_PER_M, siDigits: 0 },
}

/** `v` (in `q`'s US unit) in `u`; null/non-finite pass through. */
export function fromUs(q: Quantity, v: number, u?: Units): number
export function fromUs(q: Quantity, v: number | null | undefined, u?: Units): number | null
export function fromUs(q: Quantity, v: number | null | undefined, u: Units = units()): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return v ?? null
  return u === 'si' ? SPECS[q].toSi(v) : v
}

/** `v` in `u` back to `q`'s US unit (an input typed in SI, e.g. a GDD cutoff). */
export const toUs = (q: Quantity, v: number, u: Units = units()): number => (u === 'si' ? SPECS[q].toUs(v) : v)

/** `q`'s unit text in `u`: "°F" / "°C", "in" / "mm". */
export const unitLabel = (q: Quantity, u: Units = units()): string => (u === 'si' ? SPECS[q].si : SPECS[q].us)

/** Decimals for `q` in `u`, from the US precision `usDigits` (never below 0). */
export const digitsFor = (q: Quantity, usDigits: number, u: Units = units()): number =>
  u === 'si' ? Math.max(0, usDigits + SPECS[q].siDigits) : usDigits

/** Degree days (GDD) in `u`: °F·days × 5/9 for °C·days (1800 → 1000). */
export const degreeDays = (f: number | null | undefined, u?: Units): number | null => fromUs('tempDelta', f, u)

/**
 * The quantity behind an API column's unit, by its header ("Air Temperature [°F]" → temp,
 * "Snow Depth [in]" → snow, "Precipitation [in]" → precip); null for unitless or unit-free
 * columns (%, W/m², °, mS/cm).
 */
export function quantityOfColumn(col: string): Quantity | null {
  const unit = /\[([^\]]+)\]\s*$/.exec(col)?.[1]?.trim() ?? ''
  return quantityOfUnit(unit, col)
}

/** The quantity of a US unit string ("°F", "mi/hr", "mbar", "in"), `col` telling inches apart. */
export function quantityOfUnit(unit: string, col = ''): Quantity | null {
  switch (unit) {
    case '°F':
    case 'degF':
      return 'temp'
    case 'mi/hr':
    case 'mi/h':
    case 'mph':
      return 'speed'
    case 'mbar':
    case 'mb':
    case 'millibar':
      return 'pressure'
    case 'in/hr':
    case 'in/h':
      return 'rate'
    case 'bar':
      return 'swp'
    case 'ft':
      return 'elev'
    case 'in':
    case 'inches':
    case 'in.':
      return /^snow/i.test(col) ? 'snow' : 'precip'
    default:
      return null
  }
}

/** One value of column `col` (US) in `u`: converted when its unit has an SI form. */
export function columnValue(col: string, v: number | null | undefined, u: Units = units()): number | null {
  const q = quantityOfColumn(col)
  return q ? fromUs(q, v, u) : (v ?? null)
}

/** A US unit string as shown in `u` ("°F" → "°C", "mi/hr" → "m/s"); others unchanged. */
export function displayUnit(unit: string, col = '', u: Units = units()): string {
  if (u !== 'si') return unit
  const q = quantityOfUnit(unit, col)
  return q ? SPECS[q].si : unit
}

/**
 * Sensor depths and heights are not display units: they always read as the probe's metric depth
 * ("10 cm"), whatever `units` is. Column keys stay inch-keyed internally (LAB_SWAP); these turn
 * those inch keys back into the true cm depth for display.
 */
const IN_TO_CM: Readonly<Record<number, number>> = { 2: 5, 4: 10, 8: 20, 20: 50, 28: 70, 36: 91, 40: 100 }

/** A soil depth key in inches as shown: 4 → "10 cm" (the sensor's true depth). */
export const depthText = (inches: number): string => `${IN_TO_CM[inches] ?? Math.round(inches * 2.54)} cm`

/** Rewrite every "N in" soil depth inside `text` as cm ("Soil moisture at 4 in" → "… at 10 cm"). */
export const depthsIn = (text: string): string => text.replace(/\b(\d+) in\b/g, (_, n: string) => depthText(Number(n)))

/** The saved choice (localStorage), copied into `?units=` at boot when a link has none. */
export const UNITS_KEY = 'mco-dashboard-units'

/** The saved units, or null when absent or junk (re-checked: another app may have written it). */
export function readUnits(storage: StorageLike): Units | null {
  try {
    const v = storage.getItem(UNITS_KEY)
    return (UNITS as readonly (string | null)[]).includes(v) ? (v as Units) : null
  } catch {
    return null
  }
}

/** Remember `u` (a failed write leaves the page working). */
export function saveUnits(storage: StorageLike, u: Units): void {
  try {
    storage.setItem(UNITS_KEY, u)
  } catch {
    /* not persisted */
  }
}
