/**
 * Data Downloader request pipeline: fetch observations and/or derived
 * variables from the v2 API, outer-join them, normalise the bookkeeping
 * columns, and (for Monthly) aggregate daily rows client-side.
 *
 * This deliberately does not go through `getStationRecord`: the Downloader
 * needs an explicit QC `level`, raw API headers (no LAB_SWAP, so sensor
 * heights survive into the CSV), an outer join, and has_na OR-merging across
 * the two requests (legacy behaviour).
 */
import { aggregateMonthly, DAYS_WITH_DATA_COLUMN, type Row } from '../../lib/aggregate'
import { exclusiveEnd, fetchText, HttpError } from '../../lib/api'
import { MISSING_DATA_COLUMN, parseCsv } from '../../lib/csv'
import { DERIVED_ENDPOINTS, ENDPOINTS } from '../../lib/params'

/** Union of row keys in first-seen order. */
function mergeKeyOrder(rows: ReadonlyArray<Row>): string[] {
  const seen = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) seen.add(k)
  return [...seen]
}

export type DlPeriod = 'monthly' | 'daily' | 'hourly'

/** QC tier (`level`): 0 raw, 1 provisional, 2 fully quality-controlled. */
export type QcLevel = 0 | 1 | 2

/**
 * Dashboard-wide default: fully quality-controlled. Intentional divergence
 * from legacy (level 1): provisional data keeps gauge artefacts, e.g.
 * arskeogh Aug 2026 precip is 13.8 in at level 1 vs 0.86 in at level 2
 * (mesonet-db-rds#189).
 */
export const DEFAULT_QC_LEVEL: QcLevel = 2

export const QC_LEVEL_OPTIONS: ReadonlyArray<{ value: QcLevel; label: string; description: string }> = [
  {
    value: 0,
    label: 'Raw',
    description: 'Exactly as reported by the station; no QC applied.',
  },
  {
    value: 1,
    label: 'Provisional',
    description:
      'Only hard range breaches removed at ingest; values the daily QC checks would reject (spikes, stuck sensors, wind-affected precipitation) are kept.',
  },
  {
    value: 2,
    label: 'Quality-controlled',
    description:
      'Recommended. Fully cleaned by the daily QC pipeline (step, persistence, wind-affected precipitation, …). Rows the pipeline has not reached yet (usually the last day) are served provisionally and marked in the "provisional" column.',
  },
]

/** Derived variables offered in the element picker (legacy "DERIVED VARIABLES"). */
export interface DerivedOption {
  value: string
  label: string
  /** Only offered at stations with soil-water-potential parameters (`has_swp`). */
  requiresSwp?: boolean
}

export const DERIVED_OPTIONS: ReadonlyArray<DerivedOption> = [
  { value: 'feels_like', label: 'Feels Like Temperature' },
  { value: 'etr', label: 'Reference ET' },
  { value: 'cci', label: 'Livestock Risk Index' },
  // Legacy had these commented out of the picker but still treated them as
  // derived, so old `els=swp,…` links rely on them. Monthly = mean.
  { value: 'swp', label: 'Soil Water Potential', requiresSwp: true },
  { value: 'percent_saturation', label: 'Percent Saturation', requiresSwp: true },
]
export const DERIVED_CODES: ReadonlySet<string> = new Set(DERIVED_OPTIONS.map((o) => o.value))
export const SWP_CODES: ReadonlySet<string> = new Set(
  DERIVED_OPTIONS.filter((o) => o.requiresSwp).map((o) => o.value),
)

/** Derived options a station can offer. */
export function derivedOptionsFor(hasSwp: boolean): DerivedOption[] {
  return DERIVED_OPTIONS.filter((o) => hasSwp || !o.requiresSwp)
}

/** Hourly requests default to this many days back (not the install date). */
export const HOURLY_DEFAULT_DAYS = 30
/** Hourly ranges longer than this need a second click to confirm. */
export const HOURLY_CONFIRM_DAYS = 366

/** Inclusive day count between two YYYY-MM-DD dates. */
export function daySpan(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
}

/** Legacy dropped this unless the logger pressure element was asked for. */
const LOGGER_PRESSURE_COLUMN = 'Logger Reference Pressure [mbar]'
const LOGGER_PRESSURE_ELEMENT = 'bp_logger_0244'

const TRAILING_COLUMNS = [MISSING_DATA_COLUMN, 'provisional', 'obs_count', DAYS_WITH_DATA_COLUMN]

export interface DownloadQuery {
  station: string
  /** inclusive YYYY-MM-DD */
  start: string
  /** inclusive YYYY-MM-DD */
  end: string
  period: DlPeriod
  elements: string[]
  level: QcLevel
}

export interface DownloadResult {
  rows: Row[]
  /** CSV column order: station, datetime, values…, flags. */
  columns: string[]
  warnings: string[]
}

export function splitElements(elements: string[]): { std: string[]; derived: string[] } {
  return {
    std: elements.filter((e) => !DERIVED_CODES.has(e)),
    derived: elements.filter((e) => DERIVED_CODES.has(e)),
  }
}

/** Legacy filename: `{station}_{period}_{YYYYMMDD}_to_{YYYYMMDD}.csv`. */
export function downloadFilename(station: string, period: string, start: string, end: string) {
  const compact = (d: string) => d.replace(/-/g, '')
  return `${station}_${period}_${compact(start)}_to_${compact(end)}.csv`
}

const toBool = (v: unknown): boolean | null => {
  if (typeof v === 'boolean') return v
  if (v === null || v === undefined || v === '') return null
  return /^true$/i.test(String(v))
}

/** Normalise one parsed API row: booleans for flags, has_na renamed. */
function normaliseRow(r: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(r)) {
    if (k === 'has_na') out[MISSING_DATA_COLUMN] = toBool(v)
    else if (k === 'provisional') out[k] = toBool(v)
    else out[k] = v
  }
  return out
}

/**
 * Full outer join on (station, datetime). Overlapping value columns: right
 * wins. Flag columns (`Contains Missing Data`, `provisional`) are OR-ed, as
 * legacy did for has_na_x / has_na_y.
 */
export function outerJoin(left: Row[], right: Row[]): Row[] {
  if (left.length === 0) return right
  if (right.length === 0) return left
  const key = (r: Row) => `${r.station}||${r.datetime}`
  const out = new Map<string, Row>()
  for (const r of left) out.set(key(r), { ...r })
  for (const r of right) {
    const k = key(r)
    const prev = out.get(k)
    if (!prev) {
      out.set(k, { ...r })
      continue
    }
    const merged: Row = { ...prev, ...r }
    for (const flag of [MISSING_DATA_COLUMN, 'provisional']) {
      if (flag in prev || flag in r) {
        const a = prev[flag]
        const b = r[flag]
        merged[flag] = a === true || b === true ? true : (a ?? b ?? null)
      }
    }
    out.set(k, merged)
  }
  return [...out.values()].sort((a, b) => timeMs(a.datetime) - timeMs(b.datetime))
}

/** Epoch ms for an API datetime (`YYYY-MM-DD HH:MM:SS±HH:MM` or a date). */
export function timeMs(v: unknown): number {
  if (typeof v !== 'string') return NaN
  return Date.parse(v.includes(' ') ? v.replace(' ', 'T') : v)
}

/** Order columns: station, datetime, data columns (first-seen), then flags. */
export function orderColumns(rows: ReadonlyArray<Row>): string[] {
  const seen = mergeKeyOrder(rows)
  const head = ['station', 'datetime'].filter((c) => seen.includes(c))
  const tail = TRAILING_COLUMNS.filter((c) => seen.includes(c))
  const middle = seen.filter((c) => !head.includes(c) && !tail.includes(c))
  return [...head, ...middle, ...tail]
}

/**
 * `/derived/*` returns its value columns in no stable order between calls;
 * sort them alphabetically (keys first, flags untouched) so CSV headers are
 * reproducible.
 */
function sortValueKeys(rows: Row[]): Row[] {
  return rows.map((r) => {
    const keys = Object.keys(r)
    const fixed: string[] = keys.filter((k) => k === 'station' || k === 'datetime')
    const flags = keys.filter((k) => TRAILING_COLUMNS.includes(k))
    const values = keys.filter((k) => !fixed.includes(k) && !flags.includes(k))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    const out: Row = {}
    for (const k of [...fixed, ...values, ...flags]) out[k] = r[k]
    return out
  })
}

/** 404 "No data available…"from the API means an empty result, not an error. */
async function fetchRows(path: string, query: Record<string, unknown>): Promise<Row[]> {
  try {
    const text = await fetchText(path, { ...query, type: 'csv' })
    return parseCsv<Row>(text, { labSwap: false }).map(normaliseRow)
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return []
    throw err
  }
}

export async function fetchDownload(q: DownloadQuery): Promise<DownloadResult> {
  const { std, derived } = splitElements(q.elements)
  const warnings: string[] = []
  const common = {
    stations: q.station,
    start_time: q.start,
    end_time: exclusiveEnd(q.end),
    level: q.level,
    na_info: true,
  }

  // Monthly is aggregated from daily rows (ENDPOINTS.monthly is the daily path).
  const [obsResult, derivedResult] = await Promise.allSettled([
    std.length > 0
      ? fetchRows(ENDPOINTS[q.period], {
          ...common,
          elements: std.join(','),
          // Always ask for the full element set on data requests (legacy did
          // the same); the "Show uncommon" switch only filters the picker.
          public: false,
        })
      : Promise.resolve([] as Row[]),
    derived.length > 0
      ? fetchRows(DERIVED_ENDPOINTS[q.period], { ...common, elements: derived.join(',') })
      : Promise.resolve([] as Row[]),
  ])

  if (obsResult.status === 'rejected') throw obsResult.reason
  let obs = obsResult.value
  let der: Row[] = []
  if (derivedResult.status === 'rejected') {
    if (std.length === 0) throw derivedResult.reason
    warnings.push(
      `Derived variables (${derived.join(', ')}) could not be computed for this request; showing observations only.`,
    )
    console.warn('Derived request failed', derivedResult.reason)
  } else {
    der = sortValueKeys(derivedResult.value)
  }

  if (!std.includes(LOGGER_PRESSURE_ELEMENT)) {
    obs = obs.map((r) => {
      if (!(LOGGER_PRESSURE_COLUMN in r)) return r
      const rest = { ...r }
      delete rest[LOGGER_PRESSURE_COLUMN]
      return rest
    })
  }

  let rows = outerJoin(obs, der)
  if (q.period === 'monthly') rows = aggregateMonthly(rows)
  return { rows, columns: orderColumns(rows), warnings }
}

/**
 * Clamp a start date (YYYY-MM-DD) to the station install date, as legacy's
 * DatePicker `minDate` did. Returns the effective date and whether it moved.
 */
export function clampStart(
  start: string,
  installDate: string | null,
): { start: string; clamped: boolean } {
  if (installDate && start < installDate) return { start: installDate, clamped: true }
  return { start, clamped: false }
}
