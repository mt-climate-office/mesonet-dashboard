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

/**
 * Classify a Comprehensive Climate Index value (°F) into a risk class.
 * Moved to `./cci` (`classifyCciF`); re-exported here for existing callers.
 */
export { classifyCciF as classifyCci } from './cci'
