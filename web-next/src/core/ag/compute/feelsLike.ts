/**
 * Wind chill, heat index and "feels like", ported from
 * `mesonet-db-rds/api/app/app/derived.py` (`calc_windchill` 544-565,
 * `calc_heat_index` 568-588, `calc_feels_like` 708-727, ordering 950-981),
 * which call MetPy 1.7 `windchill(face_level_winds=False, mask_undefined=True)`
 * and `heat_index(mask_undefined=True)` (`metpy/calc/basic.py`).
 *
 * Inputs are the period mean air temperature (°C), mean RH (%) and mean wind
 * speed (m/s) at the anemometer height, unadjusted, as the API passes them.
 * feels_like = heat index ?? wind chill ?? air temperature.
 */
import type {
  DailyMet,
  FeelsLikeRegime,
  FeelsLikeSeries,
  HourlyMet,
  Nullable,
} from '../contract'
import { cToF, fToC, MS_PER_MPH } from './units'
import { clean, dailyEpochMs, ok } from './util'

/**
 * Wind Chill Temperature Index (FCM-R19-2003), °C. Undefined (null) where
 * T > 10 °C (50 °F) or V ≤ 3 mph, as MetPy's `mask_undefined`.
 */
export function windChillC(tC: Nullable, windMs: Nullable): Nullable {
  if (!ok(tC) || !ok(windMs)) return null
  if (tC > 10 || windMs <= 3 * MS_PER_MPH) return null
  const speedFactor = (windMs * 3.6) ** 0.16
  return clean((0.6215 + 0.3965 * speedFactor) * tC - 11.37 * speedFactor + 13.12)
}

/**
 * Heat index (Rothfusz 1990 with the NWS adjustments) without the undefined
 * mask, °F in and out, RH in %. Follows MetPy's branch order: T ≤ 40 °F → T;
 * the simple formula if it is < 79 °F; otherwise the Rothfusz regression;
 * then the RH ≤ 13 % (80–112 °F) and RH > 85 % (80–87 °F) adjustments.
 */
export function heatIndexUnmaskedF(tF: number, rh: number): number {
  const r = rh / 100
  let hi: number
  if (tF <= 40) {
    hi = tF
  } else {
    const a = -10.3 + 1.1 * tF + 4.7 * r
    hi =
      a < 79
        ? a
        : -42.379 +
          2.04901523 * tF +
          1014.333127 * r -
          22.475541 * tF * r -
          6.83783e-3 * tF * tF -
          5.481717e2 * r * r +
          1.22874e-1 * tF * tF * r +
          8.5282 * tF * r * r -
          1.99e-2 * tF * tF * r * r
  }
  if (rh <= 13 && tF >= 80 && tF <= 112) {
    hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(tF - 95)) / 17)
  }
  if (rh > 85 && tF >= 80 && tF <= 87) {
    hi += 0.02 * (rh - 85) * (87 - tF)
  }
  return hi
}

/**
 * Heat index, °C. Undefined (null) where T < 80 °F, as MetPy's
 * `mask_undefined`; a missing RH makes MetPy's result NaN, so null here too
 * (feels_like then falls back).
 */
export function heatIndexC(tC: Nullable, rh: Nullable): Nullable {
  if (!ok(tC) || !ok(rh)) return null
  const t = cToF(tC)
  if (t < 80) return null
  return clean(fToC(heatIndexUnmaskedF(t, rh)))
}

export interface FeelsLikeValue {
  valueC: Nullable
  regime: FeelsLikeRegime | null
}

/** feels_like = HI ?? WC ?? T (derived.py:722-726). */
export function feelsLikeValue(tC: Nullable, rh: Nullable, windMs: Nullable): FeelsLikeValue {
  const hi = heatIndexC(tC, rh)
  if (hi != null) return { valueC: hi, regime: 'heat_index' }
  const wc = windChillC(tC, windMs)
  if (wc != null) return { valueC: wc, regime: 'wind_chill' }
  if (ok(tC)) return { valueC: tC, regime: 'air_temp' }
  return { valueC: null, regime: null }
}

function build(
  base: { station: string; level: FeelsLikeSeries['level']; provisional: boolean[] },
  time: string[],
  epochMs: number[],
  t: Nullable[],
  rh: Nullable[],
  wind: Nullable[],
): FeelsLikeSeries {
  const vals = time.map((_, i) => feelsLikeValue(t[i], rh[i], wind[i]))
  return {
    station: base.station,
    level: base.level,
    provisional: [...base.provisional],
    time: [...time],
    epochMs,
    valueC: vals.map((v) => v.valueC),
    regime: vals.map((v) => v.regime),
    airC: [...t],
  }
}

/** Daily feels-like from the daily mean T, RH and wind. */
export function feelsLikeDaily(met: DailyMet): FeelsLikeSeries {
  return build(met, met.date, dailyEpochMs(met.date), met.tavgC, met.rhAvg, met.windMs)
}

/** Hourly feels-like from hourly means. */
export function feelsLikeHourly(met: HourlyMet): FeelsLikeSeries {
  return build(met, met.time, [...met.epochMs], met.tC, met.rh, met.windMs)
}
