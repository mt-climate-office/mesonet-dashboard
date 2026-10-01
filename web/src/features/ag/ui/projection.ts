/**
 * GDD projection horizon. The projection (compute `projectGdd`) runs from the
 * day after the last observed date through the chosen horizon:
 *  - `season` (default): Oct 31 of the last observed date's year, the end of
 *    the Montana growing season; once fewer than 14 days remain before Oct 31
 *    (or after it) it falls back to +60 days so the overlay is never empty;
 *  - `30` / `60`: that many days past the last observed date;
 *  - `off`: no projection.
 * A projection is only offered when the window ends at (or within 3 days of)
 * today: projecting from a past window would ignore observed data.
 */
import type { LocalDate } from '../contract'
import type { GddProjHorizon } from '../../../lib/url-state'

const addDays = (d: LocalDate, n: number): LocalDate => {
  const t = Date.parse(`${d}T00:00Z`) + n * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

const daysBetween = (a: LocalDate, b: LocalDate) =>
  Math.round((Date.parse(`${b}T00:00Z`) - Date.parse(`${a}T00:00Z`)) / 86_400_000)

export const RECENT_DAYS = 3
export const SEASON_END_MMDD = '10-31'
export const SEASON_MIN_DAYS = 14

/** Projection end date, or null when no projection should be drawn. */
export function projectionThrough(
  lastObserved: LocalDate | undefined,
  horizon: GddProjHorizon,
  today: LocalDate,
): LocalDate | null {
  if (!lastObserved || horizon === 'off') return null
  if (daysBetween(lastObserved, today) > RECENT_DAYS) return null
  if (horizon === '30') return addDays(lastObserved, 30)
  if (horizon === '60') return addDays(lastObserved, 60)
  const seasonEnd = `${lastObserved.slice(0, 4)}-${SEASON_END_MMDD}`
  return daysBetween(lastObserved, seasonEnd) >= SEASON_MIN_DAYS ? seasonEnd : addDays(lastObserved, 60)
}

export const PROJECTION_OPTIONS: { value: GddProjHorizon; label: string }[] = [
  { value: 'season', label: 'End of season (Oct 31)' },
  { value: '30', label: '+30 days' },
  { value: '60', label: '+60 days' },
  { value: 'off', label: 'Off' },
]
