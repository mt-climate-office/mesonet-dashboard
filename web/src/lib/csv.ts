import Papa from 'papaparse'
import { LAB_SWAP } from './params'

/**
 * Parse a CSV string into typed rows. Applies LAB_SWAP rename so consumers
 * can use canonical column names ("Air Temperature [°F]" etc.) without
 * worrying about which sensor height a station has.
 */
export function parseCsv<T extends Record<string, unknown>>(text: string): T[] {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    transformHeader: (h) => LAB_SWAP[h] ?? h,
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
