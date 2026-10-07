/**
 * Daily feels-like and livestock risk as each day's highest and lowest hourly value, so heat stress
 * comes from the afternoon peak and cold stress from the pre-dawn low (a daily mean averages both
 * away, and its 24-hour solar mean understates the midday sun). Inputs are hourly observations;
 * the hourly indices come from feelsLike.ts and cci.ts unchanged.
 */
import type { CciRangeSeries, FeelsLikeRangeSeries, HourlyMet, LocalDate, LocalDateTime, Nullable } from '../contract'
import { cciHourly } from './cci'
import { feelsLikeHourly } from './feelsLike'
import { ok } from './util'

/** Hours a day needs for its high and low to stand (missing hours could hide the peak). */
export const MIN_HOURS = 18

export interface DailyExtremes {
  date: LocalDate[]
  high: Nullable[]
  low: Nullable[]
  /** Index into the hourly rows of each day's high / low (null with the value). */
  highAt: (number | null)[]
  lowAt: (number | null)[]
  /** Per day: any of its hours provisional. */
  provisional: boolean[]
}

/**
 * Each local day's highest and lowest hourly value, in row order. A day with fewer than
 * `minHours` values is null, except the last day of the series (today, still in progress), which
 * keeps the high and low so far. Ties keep the first hour.
 */
export function dailyExtremes(
  time: readonly LocalDateTime[],
  values: readonly Nullable[],
  provisional: readonly boolean[] = [],
  minHours = MIN_HOURS,
): DailyExtremes {
  const out: DailyExtremes = { date: [], high: [], low: [], highAt: [], lowAt: [], provisional: [] }
  let i = 0
  while (i < time.length) {
    const day = time[i].slice(0, 10)
    let hi: number | null = null
    let lo: number | null = null
    let n = 0
    let prov = false
    for (; i < time.length && time[i].slice(0, 10) === day; i++) {
      prov ||= !!provisional[i]
      const v = values[i]
      if (!ok(v)) continue
      n++
      if (hi === null || v > values[hi]!) hi = i
      if (lo === null || v < values[lo]!) lo = i
    }
    const keep = n >= minHours || (i >= time.length && n > 0)
    out.date.push(day)
    out.highAt.push(keep ? hi : null)
    out.lowAt.push(keep ? lo : null)
    out.high.push(keep && hi !== null ? values[hi] : null)
    out.low.push(keep && lo !== null ? values[lo] : null)
    out.provisional.push(prov)
  }
  return out
}

const at = <T>(xs: readonly T[], ix: (number | null)[]): (T | null)[] => ix.map((i) => (i === null ? null : xs[i]))

/** Daily feels-like high and low (°C) with the index in force at each, and the air temperature range. */
export function feelsLikeDailyRange(met: HourlyMet): FeelsLikeRangeSeries {
  const fl = feelsLikeHourly(met)
  const e = dailyExtremes(met.time, fl.valueC, met.provisional)
  const air = dailyExtremes(met.time, met.tC, met.provisional)
  return {
    station: met.station,
    level: met.level,
    provisional: e.provisional,
    date: e.date,
    highC: e.high,
    lowC: e.low,
    highRegime: at(fl.regime, e.highAt),
    lowRegime: at(fl.regime, e.lowAt),
    airHighC: air.high,
    airLowC: air.low,
  }
}

/** Daily livestock risk (CCI) high and low (°C) with the risk class of each. */
export function cciDailyRange(met: HourlyMet, livestock: 'adult' | 'newborn' = 'adult'): CciRangeSeries {
  const c = cciHourly(met, livestock)
  const e = dailyExtremes(met.time, c.valueC, met.provisional)
  return {
    station: met.station,
    level: met.level,
    provisional: e.provisional,
    date: e.date,
    highC: e.high,
    lowC: e.low,
    highClass: at(c.class, e.highAt),
    lowClass: at(c.class, e.lowAt),
    livestock,
  }
}
