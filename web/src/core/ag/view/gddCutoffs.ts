/**
 * GDD cutoff URL state (`gdd_lo` / `gdd_hi`, in the display units: whole °F, or whole °C
 * with `units=si`) ↔ slider. The parsed state is always °F (the compute's unit).
 *
 * - Absent key → that bound is the crop's own (`GDD_CUTOFFS_F`, which may be
 *   an open upper cap, ∞).
 * - `gdd_hi=none` → explicitly no upper cutoff (custom).
 * - The slider has one extra position past {@link SLIDER_MAX},
 *   {@link SLIDER_NONE}, meaning "no upper cutoff".
 * - Pre-Wave-3 links always carried the legacy auto-set pair (the old
 *   `GDD_CROP_THRESHOLDS`); an exact match means "crop defaults" and is
 *   stripped, as are unparseable / out-of-range values (US links only: old links are °F).
 */
import type { UrlState } from '../../url-schema'
import { type Units, fromUs, toUs, units } from '../../units'
import type { GddCrop } from '../contract'
import { GDD_CUTOFFS_F } from '../compute/gdd'

export const SLIDER_MIN = 30
export const SLIDER_MAX = 100
/** Slider position meaning "no upper cutoff". */
export const SLIDER_NONE = 101
export const HI_NONE = 'none'

/** The slider's range in `u` (°C: the same 30–100 °F span, whole degrees); `none` is one past `max`. */
export function sliderBounds(u: Units = units()): { min: number; max: number; none: number } {
  return u === 'si' ? { min: -1, max: 38, none: 39 } : { min: SLIDER_MIN, max: SLIDER_MAX, none: SLIDER_NONE }
}

/** A °F cutoff as the slider and URL show it in `u` (whole °C in SI); ∞ stays ∞. */
export const cutoffInUnits = (f: number, u: Units = units()): number =>
  u === 'si' && Number.isFinite(f) ? Math.round(fromUs('temp', f, 'si')) : f

/** A cutoff typed in `u` back to °F. */
const cutoffToF = (v: number, u: Units): number => (u === 'si' ? toUs('temp', v, 'si') : v)

/** The pre-Wave-3 slider's auto-set cutoffs, written into every old link. */
export const LEGACY_GDD_URL_DEFAULTS: Record<GddCrop, readonly [number, number]> = {
  canola: [41, 100],
  corn: [50, 86],
  sunflower: [44, 100],
  wheat: [32, 95],
  barley: [32, 95],
  sugarbeet: [34, 86],
  hemp: [34, 100],
}

export interface GddCutoffState {
  /** Custom low cutoff (°F), null → crop's. */
  loF: number | null
  /** Custom high cutoff (°F, Infinity = none), null → crop's. */
  hiF: number | null
  custom: boolean
  /** The URL keys should be cleared (legacy defaults or invalid values). */
  strip: { lo: boolean; hi: boolean }
}

function parseBound(raw: string | null, allowNone: boolean, u: Units): { v: number | null; bad: boolean } {
  if (raw == null || raw === '') return { v: null, bad: false }
  if (allowNone && raw === HI_NONE) return { v: Infinity, bad: false }
  const n = Number(raw)
  const { min, max } = sliderBounds(u)
  if (!Number.isFinite(n) || n < min || n > max) return { v: null, bad: true }
  return { v: cutoffToF(n, u), bad: false }
}

/** The URL's cutoffs (read in `u`) as °F state. */
export function parseGddCutoffs(crop: GddCrop, lo: string | null, hi: string | null, u: Units = units()): GddCutoffState {
  const l = parseBound(lo, false, u)
  const h = parseBound(hi, true, u)
  const legacy = LEGACY_GDD_URL_DEFAULTS[crop]
  if (u === 'us' && l.v === legacy[0] && h.v === legacy[1]) {
    return { loF: null, hiF: null, custom: false, strip: { lo: true, hi: true } }
  }
  let loF = l.v
  let hiF = h.v
  const [cl, ch] = GDD_CUTOFFS_F[crop]
  // Inverted bounds are invalid too.
  if ((loF ?? cl) >= (hiF ?? ch)) {
    return { loF: null, hiF: null, custom: false, strip: { lo: lo != null, hi: hi != null } }
  }
  // A bound equal to the crop's own (as shown in `u`) is not custom.
  if (loF !== null && cutoffInUnits(loF, u) === cutoffInUnits(cl, u)) loF = null
  if (hiF !== null && cutoffInUnits(hiF, u) === cutoffInUnits(ch, u)) hiF = null
  return {
    loF,
    hiF,
    custom: loF != null || hiF != null,
    strip: { lo: l.bad || (lo != null && loF == null), hi: h.bad || (hi != null && hiF == null) },
  }
}

/** Slider position in `u` for a °F cutoff (∞ → the "none" position). */
export function toSlider(f: number, u: Units = units()): number {
  const { min, max, none } = sliderBounds(u)
  return Number.isFinite(f) ? Math.min(max, Math.max(min, cutoffInUnits(f, u))) : none
}

/**
 * URL writes for a finished slider drag: only a thumb that moved is written;
 * a value equal to the crop's own cutoff clears the key; the "none" position
 * clears `gdd_hi` for an open-capped crop and writes `none` otherwise.
 * `undefined` = leave the key alone. Positions and written values are in `u`.
 */
export function sliderWrites(
  crop: GddCrop,
  prev: readonly [number, number],
  next: readonly [number, number],
  u: Units = units(),
): { lo?: string | null; hi?: string | null } {
  const [cl, ch] = GDD_CUTOFFS_F[crop]
  const out: { lo?: string | null; hi?: string | null } = {}
  if (next[0] !== prev[0]) out.lo = next[0] === cutoffInUnits(cl, u) ? null : String(next[0])
  if (next[1] !== prev[1]) {
    const hi = next[1] >= sliderBounds(u).none ? Infinity : next[1]
    out.hi = hi === cutoffInUnits(ch, u) ? null : Number.isFinite(hi) ? String(hi) : HI_NONE
  }
  return out
}

/** One custom cutoff key rewritten from `from` to `to` (whole degrees); `none` and junk unchanged. */
function convertCutoffKey(raw: string | null, from: Units, to: Units): string | null {
  if (raw === null || raw === HI_NONE || from === to) return raw
  const n = Number(raw)
  return Number.isFinite(n) ? String(cutoffInUnits(cutoffToF(n, from), to)) : raw
}

/** The URL patch that switches display units to `next`: custom GDD cutoffs convert with it. */
export function toggleUnitsPatch(state: Pick<UrlState, 'units' | 'gdd_lo' | 'gdd_hi'>, next: Units): Partial<UrlState> {
  const patch: Partial<UrlState> = { units: next }
  if (state.gdd_lo !== null) patch.gdd_lo = convertCutoffKey(state.gdd_lo, state.units, next)
  if (state.gdd_hi !== null) patch.gdd_hi = convertCutoffKey(state.gdd_hi, state.units, next)
  return patch
}
