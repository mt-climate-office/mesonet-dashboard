/**
 * The Now hero's one-line summary ("Clear tonight, light SSE wind, no rain
 * in 5 days."), built from the NWS current period (sky), the latest wind and
 * the rain record. Pure and deterministic: the time of day comes in as
 * `nowWallMs` (Denver wall clock), never from the system clock.
 */
import type { ObservationRow } from '../api'
import { compassWord, formatReading } from '../variables/labels'
import type { PrecipSummary } from './precip'

/** Smallest amount (in) counted as rain; the gauges resolve 0.01 in. */
export const RAIN_MIN_IN = 0.01
/** Dry spells longer than this read "no rain in over a week". */
export const DRY_CAP_DAYS = 7

/** A calm reading after a 24 h peak gust at least this strong (mph) says so. */
export const NOTABLE_GUST_MPH = 25

/** Below this (mph) the wind is calm (Beaufort 0): the summary's "calm" and the Wind tile's "Calm". */
export const CALM_MPH = 1

export type WindClass = 'calm' | 'light' | 'breezy' | 'windy'

/** calm < 1 mph (CALM_MPH) ≤ light < 10 ≤ breezy < 20 ≤ windy. */
export function windClass(mph: number): WindClass {
  return mph < CALM_MPH ? 'calm' : mph < 10 ? 'light' : mph < 20 ? 'breezy' : 'windy'
}

// [pattern, phrase, is precipitation], first match wins: precipitation before cloud cover.
const SKY: [RegExp, string, boolean][] = [
  [/thunder/i, 'thunderstorms', true],
  [/freezing|sleet/i, 'freezing rain', true],
  [/rain.*snow|snow.*rain/i, 'rain and snow', true],
  [/snow|flurr|blizzard/i, 'snow', true],
  [/drizzle/i, 'drizzle', true],
  [/rain|shower/i, 'rain', true],
  [/fog/i, 'fog', false],
  [/smoke/i, 'smoke', false],
  [/haze/i, 'haze', false],
  [/dust/i, 'dust', false],
  [/mostly (sunny|clear)/i, 'mostly clear', false],
  [/partly (cloudy|sunny)/i, 'partly cloudy', false],
  [/mostly cloudy/i, 'mostly cloudy', false],
  [/cloudy|overcast/i, 'cloudy', false],
  [/sunny|clear|fair/i, 'clear', false],
]

/**
 * NWS `shortForecast` → a few lowercase words ("partly cloudy", "chance of
 * rain", "snow likely"), or null when unknown or empty. Only the first clause
 * of "X then Y" counts (it is the part happening now).
 */
export function skyPhrase(shortForecast: string | null | undefined): string | null {
  const first = (shortForecast ?? '').split(/\bthen\b/i)[0].trim()
  const hit = SKY.find(([re]) => re.test(first))
  if (!hit) return null
  const [, phrase, precip] = hit
  if (precip && /chance/i.test(first)) return `chance of ${phrase}`
  if (precip && /likely/i.test(first)) return `${phrase} likely`
  return phrase
}

/** "calm", "light SSE wind", …; a missing direction drops the compass word. */
export function windPhrase(mph: number, deg: number | null): string {
  const c = windClass(mph)
  if (c === 'calm') return 'calm'
  const dir = deg === null ? '' : `${compassWord(deg)} `
  return `${c === 'windy' ? 'strong' : c} ${dir}wind`
}

const dayNumber = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000

/**
 * Whole days since the last day with ≥ RAIN_MIN_IN (0 = rain today), as a
 * lower bound; Infinity for none in the last week; null when unknown.
 * Sources, best first: today's total (`p.sinceMidnight`), the daily totals of
 * the hourly rows (local dates ≤ `today`), then the 7 d total. With no rain
 * in the hourly rows but some in the 7 d total, the answer is the number of
 * dry days the rows cover (true, if conservative).
 */
export function daysSinceRain(p: PrecipSummary, hourly: readonly ObservationRow[] | undefined, today: string): number | null {
  if (p.sinceMidnight !== null && p.sinceMidnight >= RAIN_MIN_IN) return 0
  const totals = new Map<string, number>()
  for (const r of hourly ?? []) {
    const v = r['Precipitation [in]']
    const date = String(r.datetime).slice(0, 10)
    if (typeof v === 'number' && Number.isFinite(v) && date <= today) totals.set(date, (totals.get(date) ?? 0) + v)
  }
  const wet = [...totals].filter(([, v]) => v >= RAIN_MIN_IN).map(([d]) => d).sort()
  if (wet.length) return dayNumber(today) - dayNumber(wet[wet.length - 1])
  if (p.last7d !== null && p.last7d < RAIN_MIN_IN) return Infinity
  if (totals.size) return dayNumber(today) - dayNumber([...totals.keys()].sort()[0]) + 1
  if (p.last24h !== null && p.last24h >= RAIN_MIN_IN) return 1
  return null
}

/** "0.12 in of rain today" ("rain today" without an amount), "no rain since yesterday", "no rain in 4 days", "no rain in over a week", or null. */
export function rainPhrase(todayIn: number | null, days: number | null): string | null {
  if (days === null) return null
  if (days === 0) return todayIn !== null && todayIn >= RAIN_MIN_IN ? `${todayIn.toFixed(2)} in of rain today` : 'rain today'
  if (days > DRY_CAP_DAYS) return 'no rain in over a week'
  return days === 1 ? 'no rain since yesterday' : `no rain in ${days} days`
}

export interface SummaryInput {
  /** NWS current period's `shortForecast`, or null without a forecast. */
  shortForecast: string | null
  windMph: number | null
  /** Direction the wind blows from, degrees. */
  windDeg: number | null
  /** 24 h peak gust, mph (`peakGust`). */
  peakGustMph?: number | null
  /** Rain since local midnight, in. */
  rainTodayIn: number | null
  /** From `daysSinceRain`. */
  daysSinceRain: number | null
  /** Now, Denver wall-clock ms (for "tonight"). */
  nowWallMs: number
}

/** True from 18:00 to 05:59 local: the sky phrase reads "… tonight". */
export function isEvening(nowWallMs: number): boolean {
  const h = new Date(nowWallMs).getUTCHours()
  return h >= 18 || h < 6
}

/** One sentence from the parts that are known; "" when none are. */
export function summarize(input: SummaryInput): string {
  const sky = skyPhrase(input.shortForecast)
  const wind = input.windMph === null ? null : windPhrase(input.windMph, input.windDeg)
  const gust = input.peakGustMph ?? null
  const parts = [
    sky && (isEvening(input.nowWallMs) ? `${sky} tonight` : sky),
    // A calm reading after a windy day says so: "calm after gusts to 43 mph earlier".
    wind === 'calm' && gust !== null && gust >= NOTABLE_GUST_MPH ? `calm after gusts to ${formatReading('windgust', gust)} earlier` : wind,
    rainPhrase(input.rainTodayIn, input.daysSinceRain),
  ].filter((x): x is string => !!x)
  if (!parts.length) return ''
  const s = parts.join(', ')
  return `${s[0].toUpperCase()}${s.slice(1)}.`
}
