/**
 * How a time chart draws wind direction (latestTimeseries, agAnnual): compass ticks on its fixed
 * 0–360° axis, and a line that breaks where the bearing wraps through north instead of a stroke
 * across the whole plot. The circular rules themselves are core/variables/direction.
 */
import { WRAP_DEGREES } from '../variables/direction'
import type { Point } from './style'

const COMPASS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N' }

/** A wind-direction y tick: N, E, S, W, N at 0–360°; any other value in degrees ("45°"). */
export const compassTick = (deg: number): string => COMPASS[deg] ?? `${deg}°`

/**
 * `pts` with a null point midway between neighbours more than 180° apart (350° → 10° is a 20° turn
 * through north), so the line stops at the wrap rather than crossing the plot. Existing nulls stay.
 */
export function breakWraps(pts: readonly Point[]): Point[] {
  const out: Point[] = []
  pts.forEach((p, i) => {
    const prev = pts[i - 1]
    if (prev && prev[1] != null && p[1] != null && Math.abs(p[1] - prev[1]) > WRAP_DEGREES) out.push([(p[0] + prev[0]) / 2, null])
    out.push(p)
  })
  return out
}
