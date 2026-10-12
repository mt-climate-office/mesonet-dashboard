/**
 * Pure helpers shared by the Ag data adapters: API column-header parsing,
 * US → SI unit conversion, America/Denver local-time formatting and CSV
 * parsing without the dashboard's LAB_SWAP header renames.
 */
import Papa from 'papaparse'
import type { LocalDate, LocalDateTime, Nullable } from '../contract'

export const TZ = 'America/Denver'

/* ------------------------------------------------------------------ CSV */

export type RawRow = Record<string, string>

/**
 * Parse CSV text into string-valued rows, headers untouched. (The shared
 * `parseCsv` renames height-specific headers via LAB_SWAP; the Ag adapters
 * need the raw labels to recover heights and depths.)
 */
export function parseCsvRaw(text: string): RawRow[] {
  const out = Papa.parse<RawRow>(text, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
  })
  return out.data
}

/** Number or null. Empty strings, "NA", "NaN" and non-finite values → null. */
export function toNum(v: unknown): Nullable {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  if (s === '' || s === 'NA' || s === 'NaN' || s === 'nan' || s === 'None') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** API booleans arrive as "True"/"False" (pandas) or true/false. */
export function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  return /^(true|t|1)$/i.test(String(v ?? '').trim())
}

/* -------------------------------------------------------------- headers */

export type AggName = 'Minimum' | 'Maximum' | 'Average' | 'Sum' | 'Total'

export interface ParsedHeader {
  agg: AggName | null
  /** e.g. "Air Temperature", "Soil VWC", "Wind Speed". */
  name: string
  /** Sensor height (positive, above ground) or depth (negative, below) in the header's units. */
  position: number | null
  positionUnit: 'cm' | 'm' | 'ft' | 'in' | null
  /** Unit inside the brackets, e.g. "°F", "mi/h", "%", "W/m²". */
  unit: string
}

const HEADER_RE =
  /^(?:(Minimum|Maximum|Average|Sum|Total)\s+)?(.+?)(?:\s+@\s+(-?[\d.]+)\s*(cm|m|ft|in))?\s+\[([^\]]+)\]$/

/** Parse an API value-column label such as `Minimum Air Temperature @ 8 ft [°F]`. */
export function parseHeader(header: string): ParsedHeader | null {
  const m = HEADER_RE.exec(header.trim())
  if (!m) return null
  return {
    agg: (m[1] as AggName | undefined) ?? null,
    name: m[2],
    position: m[3] !== undefined ? Number(m[3]) : null,
    positionUnit: (m[4] as ParsedHeader['positionUnit']) ?? null,
    unit: m[5],
  }
}

/** Depth below the surface in positive cm from a parsed soil header. */
export function depthCm(h: ParsedHeader): number | null {
  if (h.position === null) return null
  const v = Math.abs(h.position)
  switch (h.positionUnit) {
    case 'cm':
      return v
    case 'm':
      return v * 100
    case 'in': {
      // Dashboard-renamed inch labels; map back to the nominal sensor depths.
      const IN_TO_CM: Record<number, number> = { 2: 5, 4: 10, 8: 20, 20: 50, 28: 70, 36: 91, 40: 100 }
      return IN_TO_CM[v] ?? Math.round(v * 2.54)
    }
    default:
      return null
  }
}

/** Sensor height above ground in metres from a parsed header. */
export function heightM(h: ParsedHeader): number | null {
  if (h.position === null) return null
  switch (h.positionUnit) {
    case 'm':
      return h.position
    case 'cm':
      return h.position / 100
    case 'ft':
      return Math.round(h.position * 0.3048 * 100) / 100
    case 'in':
      return h.position * 0.0254
    default:
      return null
  }
}

/* ---------------------------------------------------------------- units */

/** Returns a converter from the given API unit label to SI (contract units). */
export function toSi(unit: string): (x: number) => number {
  switch (unit.trim()) {
    case '°F':
    case 'degF':
      return (x) => ((x - 32) * 5) / 9
    case 'mi/h':
    case 'mi/hr':
    case 'mph':
    case 'mi hr^-1':
      return (x) => x * 0.44704
    case 'in':
    case 'in.':
      return (x) => x * 25.4
    case 'in/h':
    case 'in/hr':
      return (x) => x * 25.4
    case 'bar':
      return (x) => x * 100
    case 'ft':
      return (x) => x * 0.3048
    default:
      // °C, m/s, %, W/m², mm, kPa, mS/cm … already SI / contract units.
      return (x) => x
  }
}

export const fToC = toSi('°F')
export const inToMm = toSi('in')

/* ----------------------------------------------------------------- time */

/**
 * Epoch ms for an API datetime like `2025-04-01 00:00:00-06:00`
 * (also accepts `T` separators and `Z`).
 */
export function parseApiDatetime(s: string): number {
  const iso = s.trim().replace(' ', 'T')
  const t = Date.parse(iso)
  if (Number.isNaN(t)) throw new Error(`Unparseable API datetime: ${s}`)
  return t
}

const denverFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** America/Denver local date and `YYYY-MM-DDTHH:mm` for an instant. */
export function denverLocal(epochMs: number): { date: LocalDate; dateTime: LocalDateTime } {
  const parts: Record<string, string> = {}
  for (const p of denverFmt.formatToParts(new Date(epochMs))) parts[p.type] = p.value
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return { date, dateTime: `${date}T${parts.hour}:${parts.minute}` }
}

/** `YYYY-MM-DD` + n days (calendar arithmetic, no time zone involved). */
export function addDays(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Epoch ms of local midnight that starts `date` in America/Denver. */
export function denverMidnight(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number)
  // Denver is UTC-7 or UTC-6; probe both and keep the one that formats back.
  for (const offH of [7, 6]) {
    const t = Date.UTC(y, m - 1, d, offH)
    const loc = denverLocal(t)
    if (loc.date === date && loc.dateTime.endsWith('T00:00')) return t
  }
  return Date.UTC(y, m - 1, d, 7)
}
