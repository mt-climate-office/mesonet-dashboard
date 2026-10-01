/**
 * Pure helpers lifted verbatim from components/charts/DerivedChart.tsx so they
 * can be unit-tested. Workstream A's compute library (see ../contract.ts)
 * supersedes these; until then DerivedChart keeps calling them. Units are the
 * chart's display units (°F), not the contract's SI.
 */

/**
 * "Method B" growing degree day:
 *   Tmin' = max(low, Tmin)   // floor
 *   Tmax' = min(high, Tmax)  // cap
 *   GDD   = max(0, (Tmin' + Tmax') / 2 - low)
 *
 * Used because the new RDS API ignores `low`/`high` query params and always
 * uses its per-crop default thresholds. To make the slider responsive, we
 * recompute from Tmax/Tmin (which the API does return when `keep=true`).
 */
export function methodBGdd(tmin: number, tmax: number, low: number, high: number): number {
  const lo = Math.max(low, tmin)
  const hi = Math.min(high, tmax)
  return Math.max(0, (lo + hi) / 2 - low)
}

/** Livestock CCI risk classes; keys of `CCI_RISK_COLORS` in lib/params. */
export type CciRiskClass =
  | 'No Stress'
  | 'Mild'
  | 'Moderate'
  | 'Severe'
  | 'Extreme'
  | 'Extreme Danger'

/** Classify a Comprehensive Climate Index value (°F) into a risk class. */
export function classifyCci(value: number, newborn: boolean): CciRiskClass {
  if (value >= 113) return 'Extreme Danger'
  if (value >= 105) return 'Extreme'
  if (value >= 96) return 'Severe'
  if (value >= 87) return 'Moderate'
  if (value >= 77) return 'Mild'
  if (newborn) {
    if (value >= 42) return 'No Stress'
    if (value >= 32) return 'Mild'
    if (value >= 23) return 'Moderate'
    if (value >= 14) return 'Severe'
    if (value >= 5) return 'Extreme'
    return 'Extreme Danger'
  }
  if (value >= 33) return 'No Stress'
  if (value >= 14) return 'Mild'
  if (value >= -4) return 'Moderate'
  if (value >= -22) return 'Severe'
  if (value >= -40) return 'Extreme'
  return 'Extreme Danger'
}
