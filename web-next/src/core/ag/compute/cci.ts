/**
 * Comprehensive Climate Index (Mader et al. 2010), ported from
 * `mesonet-db-rds/api/app/app/derived.py` (`calc_rh_correction_factor`
 * 616-632, `calc_ws_correction_factor` 635-651, `calc_rad_correction_factor`
 * 654-672, `calc_comprehensive_climate_index` 675-705).
 *
 * Inputs are the period mean air temperature (°C), RH (%), wind speed (m/s,
 * at the anemometer height, unadjusted) and solar radiation (W/m²).
 *
 * Divergence D-CCI-1 (DIVERGENCES.md): a negative solar reading (night-time
 * sensor offset) is clamped to 0 before √R; the API returns NaN there.
 */
import type { CciClass, CciSeries, DailyMet, HourlyMet, Nullable } from '../contract'
import { cToF } from './units'
import { clean, dailyEpochMs, ok } from './util'

/** RH correction (derived.py:616-632). */
export function cciRhCorrection(rh: number, tC: number): number {
  const first = Math.exp(0.00182 * rh + 1.8e-5 * tC * rh)
  const second = (0.000054 * tC ** 2 + 0.00192 * tC - 0.0246) * (rh - 30)
  return first * second
}

/** Wind correction (derived.py:635-651); 0 below 1 m/s (derived.py:699). */
export function cciWindCorrection(ws: number): number {
  if (ws < 1) return 0
  const firstParen = 1 / (2.26 * ws + 0.23) ** 0.45
  const logn = Math.log(2.26 * ws + 0.33) / Math.log(0.3)
  const secondParen = 2.9 + 1.14e-6 * ws ** 2.5 - logn ** -2
  const bottom = Math.exp(firstParen * secondParen)
  return -6.56 / bottom - 0.00566 * ws ** 2 + 3.33
}

/** Radiation correction (derived.py:654-672), with R clamped at 0 (D-CCI-1). */
export function cciRadCorrection(sradWm2: number, tC: number): number {
  const r = Math.max(0, sradWm2)
  return 0.0076 * r - 0.00002 * r * tC + 0.00005 * tC ** 2 * Math.sqrt(r) + 0.1 * tC - 2
}

/** CCI, °C, for one row; null if any input is missing. */
export function cciValueC(tC: Nullable, rh: Nullable, windMs: Nullable, sradWm2: Nullable): Nullable {
  if (!ok(tC) || !ok(rh) || !ok(windMs) || !ok(sradWm2)) return null
  return clean(tC + cciRhCorrection(rh, tC) + cciWindCorrection(windMs) + cciRadCorrection(sradWm2, tC))
}

/** CCI (°F) from which heat stress starts (Mild); below the cold onset is cold stress. */
export const CCI_HEAT_ONSET_F = 77

/** CCI (°F) below which cold stress starts: newborn calves feel the cold 9 °F sooner. */
export const cciColdOnsetF = (livestock: 'adult' | 'newborn'): number => (livestock === 'newborn' ? 42 : 33)

/** Which end of the index a CCI value (°F) is at; meaningful for a stress class (not No Stress). */
export const cciSide = (valueF: number): 'cold' | 'heat' => (valueF >= CCI_HEAT_ONSET_F ? 'heat' : 'cold')

/**
 * Risk class for a CCI value in °F (thresholds as published, in °F; lifted
 * from the legacy dashboard / DerivedChart). Newborn calves use the
 * cold-stress thresholds shifted warmer.
 */
export function classifyCciF(value: number, newborn: boolean): CciClass {
  if (value >= 113) return 'Extreme Danger'
  if (value >= 105) return 'Extreme'
  if (value >= 96) return 'Severe'
  if (value >= 87) return 'Moderate'
  if (value >= CCI_HEAT_ONSET_F) return 'Mild'
  if (newborn) {
    if (value >= cciColdOnsetF('newborn')) return 'No Stress'
    if (value >= 32) return 'Mild'
    if (value >= 23) return 'Moderate'
    if (value >= 14) return 'Severe'
    if (value >= 5) return 'Extreme'
    return 'Extreme Danger'
  }
  if (value >= cciColdOnsetF('adult')) return 'No Stress'
  if (value >= 14) return 'Mild'
  if (value >= -4) return 'Moderate'
  if (value >= -22) return 'Severe'
  if (value >= -40) return 'Extreme'
  return 'Extreme Danger'
}

/** Risk class for a CCI value in °C. */
export function classifyCciC(valueC: Nullable, livestock: 'adult' | 'newborn'): CciClass | null {
  return ok(valueC) ? classifyCciF(cToF(valueC), livestock === 'newborn') : null
}

function build(
  base: { station: string; level: CciSeries['level']; provisional: boolean[] },
  time: string[],
  epochMs: number[],
  t: Nullable[],
  rh: Nullable[],
  wind: Nullable[],
  srad: Nullable[],
  livestock: 'adult' | 'newborn',
): CciSeries {
  const valueC = time.map((_, i) => cciValueC(t[i], rh[i], wind[i], srad[i]))
  return {
    station: base.station,
    level: base.level,
    provisional: [...base.provisional],
    time: [...time],
    epochMs,
    valueC,
    class: valueC.map((v) => classifyCciC(v, livestock)),
    livestock,
  }
}

/** Daily CCI from daily mean T, RH, wind and solar. */
export function cciDaily(met: DailyMet, livestock: 'adult' | 'newborn' = 'adult'): CciSeries {
  return build(met, met.date, dailyEpochMs(met.date), met.tavgC, met.rhAvg, met.windMs, met.sradWm2, livestock)
}

/** Hourly CCI from hourly means. */
export function cciHourly(met: HourlyMet, livestock: 'adult' | 'newborn' = 'adult'): CciSeries {
  return build(met, met.time, [...met.epochMs], met.tC, met.rh, met.windMs, met.sradWm2, livestock)
}
