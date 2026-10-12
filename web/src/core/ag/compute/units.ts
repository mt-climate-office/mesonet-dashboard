/**
 * Unit conversions. The only place in the Ag feature that converts between
 * the contract's SI units and US display units. Compute code works in SI;
 * adapters and the display edge call these.
 *
 * Each helper accepts `null` and returns `null` for it, so it can be mapped
 * straight over a contract column.
 */
import type { Nullable } from '../contract'

/** Exact: 1 mph = 0.44704 m/s (international mile / hour). */
export const MS_PER_MPH = 0.44704
/** Exact: 1 in = 25.4 mm. */
export const MM_PER_IN = 25.4
/** Exact: 1 bar = 100 kPa. */
export const KPA_PER_BAR = 100

type Conv = {
  (x: number): number
  (x: Nullable): Nullable
}

function nullable(f: (x: number) => number): Conv {
  return ((x: Nullable) => (x == null ? null : f(x))) as Conv
}

export const fToC: Conv = nullable((f) => ((f - 32) * 5) / 9)
export const cToF: Conv = nullable((c) => (c * 9) / 5 + 32)
/** Temperature *difference* (e.g. a GDD increment), °C → °F. */
export const deltaCToF: Conv = nullable((c) => (c * 9) / 5)
/** Temperature *difference*, °F → °C. */
export const deltaFToC: Conv = nullable((f) => (f * 5) / 9)
export const mphToMs: Conv = nullable((v) => v * MS_PER_MPH)
export const msToMph: Conv = nullable((v) => v / MS_PER_MPH)
export const mmToIn: Conv = nullable((v) => v / MM_PER_IN)
export const inToMm: Conv = nullable((v) => v * MM_PER_IN)
export const kPaToBar: Conv = nullable((v) => v / KPA_PER_BAR)
export const barToKPa: Conv = nullable((v) => v * KPA_PER_BAR)
