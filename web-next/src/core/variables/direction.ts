/**
 * Wind direction is circular: 350° and 10° are 20° apart, not 340°, and their
 * average is north, not south. The variable page's stats, the Charts list's
 * sparkline and the chart lines use these instead of plain arithmetic. Degrees.
 */

/** The display variable these rules apply to (core/params ELEM_MAP). */
export const WIND_DIRECTION = 'Wind Direction'

/** A step from one bearing to the next that is shorter the other way round (through north) wraps. */
export const WRAP_DEGREES = 180

/** Below this resultant length the bearings point every way and no direction prevails. */
export const PREVAILING_MIN_STRENGTH = 0.15

/**
 * Vector mean of `degs`: `deg` in [0, 360) and `strength`, the mean resultant length (1 when every
 * bearing is the same, near 0 when they cancel out); null without finite values.
 */
export function circularMean(degs: readonly (number | null)[]): { deg: number; strength: number } | null {
  let x = 0
  let y = 0
  let n = 0
  for (const d of degs) {
    if (d === null || !Number.isFinite(d)) continue
    const r = (d * Math.PI) / 180
    x += Math.cos(r)
    y += Math.sin(r)
    n++
  }
  if (!n) return null
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  // Round away float noise so an exact east stays 90, not 89.99999999999999.
  return { deg: Number(deg.toFixed(6)) % 360, strength: Math.hypot(x, y) / n }
}
