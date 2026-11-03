/**
 * Types for `MCO.summary` (mco-web-style summary/mco-summary.js, pinned in index.html after core): the Now
 * hero's one-line summary and the row readers that feed it. Hand-written from the module's source comments
 * (0.17.0); only what the dashboard calls, plus the shapes it reads. The kit ships no types: when the pin
 * moves, re-read the module and update these.
 *
 * Values are US (in, mph); `units` sets only how the two printed amounts read. Times are Denver wall-clock
 * ms (core/sensorEvents). Row `datetime`s may be wall-clock strings (the API's CSV, as here) or epoch ms.
 */

export type SummaryUnits = 'us' | 'si'
export type WindClass = 'calm' | 'light' | 'breezy' | 'windy'

/** A row with a `datetime` and any columns ("Precipitation [in]", "Gust Speed …"). */
export interface SummaryRow {
  datetime?: unknown
  [column: string]: unknown
}

export interface PrecipTotals {
  sinceMidnight: number | null
  last24h: number | null
  last7d: number | null
  ytd: number | null
}

export interface KitSummaryInput {
  shortForecast: string | null | undefined
  windMph: number | null | undefined
  windDeg: number | null | undefined
  peakGustMph?: number | null
  precipTodayIn: number | null | undefined
  daysSincePrecip: number | null | undefined
  nowWallMs: number
  units?: SummaryUnits
}

export interface McoSummary {
  PRECIP_MIN_IN: number
  DRY_CAP_DAYS: number
  NOTABLE_GUST_MPH: number
  CALM_MPH: number
  windClass(mph: number): WindClass
  skyPhrase(shortForecast: string | null | undefined): string | null
  windPhrase(mph: number, deg: number | null | undefined): string
  daysSincePrecip(p: Pick<PrecipTotals, 'sinceMidnight' | 'last24h' | 'last7d'>, hourly: readonly SummaryRow[] | undefined, today: string): number | null
  precipPhrase(todayIn: number | null | undefined, days: number | null | undefined, units?: SummaryUnits): string | null
  isEvening(nowWallMs: number): boolean
  summarize(input: KitSummaryInput): string
  peakGust(rows: readonly SummaryRow[] | undefined, latest: number | null, nowWallMs: number, hours?: number): number | null
  hourlyPrecip(rows: readonly SummaryRow[], today: string): { sinceMidnight: number; last24h: number } | null
  currentPeriod<T extends { startTime: string; endTime: string }>(periods: readonly T[] | undefined, nowWallMs: number): T | null
}
