// Pure logic for the two-slider threshold control (rangeSlider.ts): snapping,
// keeping low below high, and the optional "none" stop one step past `max`
// on the high slider, which means "no upper cutoff" (high = null). No DOM.

export interface RangeConfig {
  min: number
  max: number
  step: number
  /** Adds the "none" stop at max + step on the high slider. */
  allowNone: boolean
}

export interface RangeValue {
  low: number
  /** null = no upper cutoff (only when allowNone). */
  high: number | null
}

/** `n` rounded to the nearest step counted from `min`, within [min, max]. */
export function snap(n: number, cfg: RangeConfig): number {
  const stepped = cfg.min + Math.round((n - cfg.min) / cfg.step) * cfg.step
  // Rounding to 10 decimals drops float noise from fractional steps (0.1 + 0.2).
  return Math.min(cfg.max, Math.max(cfg.min, Number(stepped.toFixed(10))))
}

/** Top of the high slider: one step past `max` when the "none" stop exists. */
export function highSliderMax(cfg: RangeConfig): number {
  return cfg.allowNone ? cfg.max + cfg.step : cfg.max
}

/** High slider position for a high value (null sits on the "none" stop). */
export function highToSlider(high: number | null, cfg: RangeConfig): number {
  return high === null ? highSliderMax(cfg) : high
}

/** High value for a slider position (past `max` reads as null when allowed). */
export function sliderToHigh(position: number, cfg: RangeConfig): number | null {
  return cfg.allowNone && position > cfg.max ? null : snap(position, cfg)
}

/** Value with low moved to `low`, held at least one step below high. */
export function withLow(value: RangeValue, low: number, cfg: RangeConfig): RangeValue {
  const ceiling = value.high === null ? cfg.max : value.high - cfg.step
  return { low: Math.min(snap(low, cfg), Math.max(cfg.min, ceiling)), high: value.high }
}

/** Value with high moved to slider `position`, held at least one step above low. */
export function withHigh(value: RangeValue, position: number, cfg: RangeConfig): RangeValue {
  const high = sliderToHigh(position, cfg)
  if (high === null) return { low: value.low, high: null }
  return { low: value.low, high: Math.max(high, Math.min(cfg.max, value.low + cfg.step)) }
}

/** Value made consistent with `cfg`: snapped, ordered, null high only when allowed. */
export function normalizeRange(value: RangeValue, cfg: RangeConfig): RangeValue {
  const high = value.high === null ? (cfg.allowNone ? null : cfg.max) : snap(value.high, cfg)
  return withLow({ low: cfg.min, high }, value.low, cfg)
}

/** Readable value for labels and aria-valuetext, e.g. "50 °F" or "No upper limit". */
export function valueText(n: number | null, unit: string): string {
  if (n === null) return 'No upper limit'
  return unit ? `${n} ${unit}` : String(n)
}
