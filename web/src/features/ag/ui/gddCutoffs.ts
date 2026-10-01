/**
 * GDD cutoff URL state (`gdd_lo` / `gdd_hi`, °F) ↔ slider.
 *
 * - Absent key → that bound is the crop's own (`GDD_CUTOFFS_F`, which may be
 *   an open upper cap, ∞).
 * - `gdd_hi=none` → explicitly no upper cutoff (custom).
 * - The slider has one extra position past {@link SLIDER_MAX},
 *   {@link SLIDER_NONE}, meaning "no upper cutoff".
 * - Pre-Wave-3 links always carried the legacy auto-set pair (the old
 *   `GDD_CROP_THRESHOLDS`); an exact match means "crop defaults" and is
 *   stripped, as are unparseable / out-of-range values.
 */
import type { GddCrop } from '../contract'
import { GDD_CUTOFFS_F } from '../compute/gdd'

export const SLIDER_MIN = 30
export const SLIDER_MAX = 100
/** Slider position meaning "no upper cutoff". */
export const SLIDER_NONE = 101
export const HI_NONE = 'none'

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

function parseBound(raw: string | null, allowNone: boolean): { v: number | null; bad: boolean } {
  if (raw == null || raw === '') return { v: null, bad: false }
  if (allowNone && raw === HI_NONE) return { v: Infinity, bad: false }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < SLIDER_MIN || n > SLIDER_MAX) return { v: null, bad: true }
  return { v: n, bad: false }
}

export function parseGddCutoffs(crop: GddCrop, lo: string | null, hi: string | null): GddCutoffState {
  const l = parseBound(lo, false)
  const h = parseBound(hi, true)
  const legacy = LEGACY_GDD_URL_DEFAULTS[crop]
  if (l.v === legacy[0] && h.v === legacy[1]) {
    return { loF: null, hiF: null, custom: false, strip: { lo: true, hi: true } }
  }
  let loF = l.v
  let hiF = h.v
  const [cl, ch] = GDD_CUTOFFS_F[crop]
  // Inverted bounds are invalid too.
  if ((loF ?? cl) >= (hiF ?? ch)) {
    return { loF: null, hiF: null, custom: false, strip: { lo: lo != null, hi: hi != null } }
  }
  // A bound equal to the crop's own is not custom.
  if (loF === cl) loF = null
  if (hiF === ch) hiF = null
  return {
    loF,
    hiF,
    custom: loF != null || hiF != null,
    strip: { lo: l.bad || (lo != null && loF == null), hi: h.bad || (hi != null && hiF == null) },
  }
}

/** Slider position for a cutoff (∞ → the "none" position). */
export const toSlider = (f: number) =>
  Number.isFinite(f) ? Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, f)) : SLIDER_NONE

/**
 * URL writes for a finished slider drag: only a thumb that moved is written;
 * a value equal to the crop's own cutoff clears the key; the "none" position
 * clears `gdd_hi` for an open-capped crop and writes `none` otherwise.
 * `undefined` = leave the key alone.
 */
export function sliderWrites(
  crop: GddCrop,
  prev: readonly [number, number],
  next: readonly [number, number],
): { lo?: string | null; hi?: string | null } {
  const [cl, ch] = GDD_CUTOFFS_F[crop]
  const out: { lo?: string | null; hi?: string | null } = {}
  if (next[0] !== prev[0]) out.lo = next[0] === cl ? null : String(next[0])
  if (next[1] !== prev[1]) {
    const hiF = next[1] >= SLIDER_NONE ? Infinity : next[1]
    out.hi = hiF === ch ? null : Number.isFinite(hiF) ? String(hiF) : HI_NONE
  }
  return out
}
