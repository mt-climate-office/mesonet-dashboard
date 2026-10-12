/**
 * When the Now overview shows the snow depth tile: only when there is snow.
 * Snow depth sensors read a little above or below zero on bare ground, so
 * "snow" means a depth of at least 0.5 in, now or in any hour of the 72 h
 * sparkline rows (so the tile stays up for a day or two after a melt).
 */
import type { ObservationRow } from '../api'

/** Smallest depth (in) counted as snow; below it a reading is sensor noise. */
export const SNOW_MIN_IN = 0.5

/** True when `latestIn` (in, null when not reported) or any hourly `Snow Depth` reading is ≥ SNOW_MIN_IN. */
export function hasSnow(latestIn: number | null, hourly: readonly ObservationRow[] | undefined): boolean {
  if (latestIn !== null && latestIn >= SNOW_MIN_IN) return true
  return (hourly ?? []).some((row) =>
    Object.keys(row).some((col) => {
      const v = row[col]
      return col.startsWith('Snow Depth') && typeof v === 'number' && v >= SNOW_MIN_IN
    }),
  )
}
