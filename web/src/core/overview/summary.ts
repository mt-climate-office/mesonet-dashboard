/**
 * The Now hero's one-line summary ("Clear tonight, light SSE wind, no
 * precipitation in 5 days."), built from the NWS current period (sky), the latest wind and
 * the precipitation record. The logic is the kit's `MCO.summary` (mco-web-style
 * summary/mco-summary.js, pinned with SRI in index.html, tested in the kit's
 * tools/check-summary.mjs); this module types it for the app and passes the display units
 * (core/units). Pure and deterministic: the time of day comes in as `nowWallMs` (Denver
 * wall clock), never from the system clock.
 *
 * Read at call time, never at import: the kit's classic scripts run before the app module,
 * and the unit tests evaluate the same pinned files into the global first (test/kit.ts).
 */
import type { ObservationRow } from '../api'
import type { McoSummary, WindClass } from '../../types/mco-summary'
import { units } from '../units'
import type { PrecipSummary } from './precip'

export type { WindClass } from '../../types/mco-summary'

/** `MCO.summary`. */
const kit = (): McoSummary => MCO.summary

/**
 * The kit's thresholds, as constants for the modules that import them at load (the Wind
 * tile, the wind roses). summary.test.ts checks each equals `MCO.summary`'s.
 */
/** Smallest amount (in) counted as precipitation; the gauges resolve 0.01 in. */
export const PRECIP_MIN_IN = 0.01
/** Dry spells longer than this read "no precipitation in over a week". */
export const DRY_CAP_DAYS = 7
/** A calm reading after a 24 h peak gust at least this strong (mph) says so. */
export const NOTABLE_GUST_MPH = 25
/** Below this (mph) the wind is calm (Beaufort 0): the summary's "calm" and the Wind tile's "Calm". */
export const CALM_MPH = 1

/** calm < 1 mph (CALM_MPH) ≤ light < 10 ≤ breezy < 20 ≤ windy. */
export const windClass = (mph: number): WindClass => kit().windClass(mph)

/**
 * NWS `shortForecast` → a few lowercase words ("partly cloudy", "chance of
 * rain", "snow likely"), or null when unknown or empty. Only the first clause
 * of "X then Y" counts (it is the part happening now).
 */
export const skyPhrase = (shortForecast: string | null | undefined): string | null => kit().skyPhrase(shortForecast)

/** "calm", "light SSE wind", …; a missing direction drops the compass word. */
export const windPhrase = (mph: number, deg: number | null): string => kit().windPhrase(mph, deg)

/**
 * Whole days since the last day with ≥ PRECIP_MIN_IN (0 = precipitation today), as a
 * lower bound; Infinity for none in the last week; null when unknown.
 * Sources, best first: today's total (`p.sinceMidnight`), the daily totals of
 * the hourly rows (local dates ≤ `today`), then the 7 d total. With no precipitation
 * in the hourly rows but some in the 7 d total, the answer is the number of
 * dry days the rows cover (true, if conservative).
 */
export const daysSincePrecip = (p: PrecipSummary, hourly: readonly ObservationRow[] | undefined, today: string): number | null =>
  kit().daysSincePrecip(p, hourly, today)

/** "0.12 in of precipitation today" ("3.1 mm …" in SI; "precipitation today" without an amount), "no precipitation since yesterday", "no precipitation in 4 days", "no precipitation in over a week", or null. */
export const precipPhrase = (todayIn: number | null, days: number | null): string | null => kit().precipPhrase(todayIn, days, units())

export interface SummaryInput {
  /** NWS current period's `shortForecast`, or null without a forecast. */
  shortForecast: string | null
  windMph: number | null
  /** Direction the wind blows from, degrees. */
  windDeg: number | null
  /** 24 h peak gust, mph (`peakGust`). */
  peakGustMph?: number | null
  /** Precipitation since local midnight, in. */
  precipTodayIn: number | null
  /** From `daysSincePrecip`. */
  daysSincePrecip: number | null
  /** Now, Denver wall-clock ms (for "tonight"). */
  nowWallMs: number
}

/** True from 18:00 to 05:59 local: the sky phrase reads "… tonight". */
export const isEvening = (nowWallMs: number): boolean => kit().isEvening(nowWallMs)

/** One sentence from the parts that are known; "" when none are. Amounts in the display units. */
export const summarize = (input: SummaryInput): string => kit().summarize({ ...input, units: units() })
