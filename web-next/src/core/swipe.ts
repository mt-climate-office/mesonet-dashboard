/**
 * Horizontal swipe on a chart page (prev/next variable on touch): from a
 * finished gesture's travel, which way to step. Mostly sideways and far
 * enough to be deliberate, so a vertical scroll that drifts never steps.
 * Pure; ui/layout/swipe.ts feeds it pointer events.
 */

/** Least sideways travel (CSS px), and how much more sideways than vertical it must be. */
const SWIPE_MIN_PX = 60
const SWIPE_RATIO = 2

/** −1 (swipe right: the previous variable), 1 (swipe left: the next), or 0 (not a swipe). */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}
