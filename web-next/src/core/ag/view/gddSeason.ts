/**
 * The GDD tool's default window: the crop's growing season, so the running
 * total starts at planting and the stages mean something. Used by `resolveAgTab`
 * when the URL has no `ag_from` / `ag_to`. Pure.
 */
import type { GddCrop, LocalDate } from '../contract'

/**
 * Approximate typical Montana planting date and end of season per crop
 * (MM-DD): spring wheat, barley and sugarbeet in mid-April, canola and corn
 * about May 1, sunflower and hemp once soils warm in late May; the season
 * ends around harvest or the first killing frost. A default only: the Dates
 * chip sets any window.
 */
export const GDD_SEASON: Record<GddCrop, { plant: string; end: string }> = {
  wheat: { plant: '04-15', end: '09-30' },
  barley: { plant: '04-15', end: '09-30' },
  canola: { plant: '05-01', end: '09-30' },
  corn: { plant: '05-01', end: '10-15' },
  sugarbeet: { plant: '04-15', end: '10-31' },
  sunflower: { plant: '05-20', end: '10-15' },
  hemp: { plant: '05-25', end: '10-15' },
}

/**
 * The crop's current season (America/Denver dates): planting → today while
 * it runs, planting → season end once it is over, and last year's season
 * before this year's planting date.
 */
export function gddSeasonWindow(crop: GddCrop, today: LocalDate): { start: LocalDate; end: LocalDate } {
  const { plant, end } = GDD_SEASON[crop]
  const year = Number(today.slice(0, 4))
  const md = today.slice(5)
  if (md < plant) return { start: `${year - 1}-${plant}`, end: `${year - 1}-${end}` }
  return { start: `${year}-${plant}`, end: md <= end ? today : `${year}-${end}` }
}
