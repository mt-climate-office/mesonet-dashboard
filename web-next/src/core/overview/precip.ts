/**
 * Precipitation tile numbers: since midnight, 24 h, 7 d and year to date.
 * HydroMet stations have the `/derived/ppt/` summary (all four); others fall
 * back to the hourly request (since midnight and 24 h only). Inches.
 */
import type { PptSummaryRow } from '../api'

export interface PrecipSummary {
  sinceMidnight: number | null
  last24h: number | null
  last7d: number | null
  ytd: number | null
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

/** From the `/derived/ppt/` row when present, else from the hourly sums (or all null). */
export function precipSummary(
  ppt: PptSummaryRow | undefined,
  hourly: { sinceMidnight: number; last24h: number } | null,
): PrecipSummary {
  if (ppt) {
    return {
      sinceMidnight: num(ppt['Precipitation Since Midnight [in]']),
      last24h: num(ppt['24-hour Precipitation [in]']),
      last7d: num(ppt['7-day Precipitation [in]']),
      ytd: num(ppt['Year to Date Precipitation [in]']),
    }
  }
  return { sinceMidnight: hourly?.sinceMidnight ?? null, last24h: hourly?.last24h ?? null, last7d: null, ytd: null }
}
