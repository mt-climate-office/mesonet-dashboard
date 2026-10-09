/**
 * API CSV parsing (papaparse + LAB_SWAP header renames), query-string
 * building and CSV export for the Downloader.
 */
import Papa from 'papaparse'
import { labSwapHeader } from './params'

/**
 * Bookkeeping columns the API returns alongside element values (v2 adds
 * `provisional`; `na_info=true` adds `has_na`/`obs_count`). Never plot or
 * tabulate these as variables.
 */
export const META_COLUMNS: ReadonlySet<string> = new Set([
  'station',
  'datetime',
  'provisional',
  'has_na',
  'obs_count',
])

export interface ParseCsvOptions {
  /**
   * Apply the LAB_SWAP header rename (default true). The Data Downloader
   * passes false so exported CSVs keep the API's exact headers, including
   * sensor heights/depths (legacy parity).
   */
  labSwap?: boolean
}

/**
 * Parse a CSV string into typed rows. By default applies LAB_SWAP rename so
 * consumers can use canonical column names ("Air Temperature [°F]" etc.)
 * without worrying about which sensor height a station has.
 */
export function parseCsv<T extends Record<string, unknown>>(
  text: string,
  { labSwap = true }: ParseCsvOptions = {},
): T[] {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    transformHeader: labSwap ? labSwapHeader : undefined,
    // The v2 API writes Python-style `True`/`False`; papaparse's
    // dynamicTyping only recognises `true`/`TRUE`/`false`/`FALSE`, so
    // lower-case exact matches here (transform runs before dynamicTyping)
    // and they come back as real booleans. A bare "False" string is truthy.
    transform: (v) => (v === 'True' ? 'true' : v === 'False' ? 'false' : v),
  })
  if (result.errors.length > 0) {
    const first = result.errors[0]
    if (first.code !== 'TooFewFields' && first.code !== 'TooManyFields') {
      console.warn('CSV parse warning:', result.errors)
    }
  }
  return result.data as T[]
}

/** Build a query string, joining array values with commas (unencoded). */
export function buildQuery(
  params: Record<string, string | number | boolean | string[] | undefined | null>,
): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    const val = Array.isArray(v) ? v.join(',') : String(v)
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(val).replace(/%2C/g, ',')}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

/** Column the Downloader exposes for the API's `has_na` flag (legacy name). */
export const MISSING_DATA_COLUMN = 'Contains Missing Data'

/**
 * Serialize rows to CSV text with an explicit column order (papaparse
 * `unparse`). Values are written as-is, so API datetime strings such as
 * `2026-08-28 00:00:00-06:00` are not reformatted; null/undefined → empty.
 */
export function toCsv(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns: string[],
): string {
  return Papa.unparse(
    {
      fields: columns,
      data: rows.map((r) => columns.map((c) => r[c] ?? null)),
    },
    { newline: '\n' },
  )
}
