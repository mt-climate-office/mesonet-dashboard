/**
 * Ag Tools compute library: pure, SI-in/SI-out implementations of every
 * derived variable the dashboard shows (see ../contract.ts for conventions and
 * ../DIVERGENCES.md for every intentional difference from the API).
 */
export { etoDaily, etoHourly, etoDailyValue, etoHourlyValue, windAt2m, hourUtcMinus7 } from './eto'
export type { EtoSite } from './eto'
export {
  gdd,
  projectGdd,
  gddDayF,
  stageAt,
  cumulativeSum,
  GDD_CUTOFFS_F,
  DEFAULT_GDD_CUTOFFS_F,
} from './gdd'
export type { GddOptions, StageLabel } from './gdd'
export {
  feelsLikeDaily,
  feelsLikeHourly,
  feelsLikeValue,
  windChillC,
  heatIndexC,
  heatIndexUnmaskedF,
} from './feelsLike'
export type { FeelsLikeValue } from './feelsLike'
export { cciDaily, cciHourly, cciValueC, classifyCciC, classifyCciF } from './cci'
export { swp, percentSaturation, frozenMask, applyFrozenMask, fxInverse } from './soil'
export type { FrozenMask } from './soil'
export { groupByYear, hourlyToDaily, isCumulativeVariable, CUMULATIVE_VARIABLES } from './annual'
export type { AnnualTrace, AnnualOptions } from './annual'
export * from './units'
export { dayOfYear, denverMidnightEpochMs } from './util'
