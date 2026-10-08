/**
 * The Wind direction page's Rose view (`wd=rose`): the wind rose of the page's
 * window (core/models/windRose, core/charts windRoseLargeChart) in place of the
 * time series. It follows the range chips and Custom dates but not All years
 * (that chip is off beside it, with its reason), and draws hourly or raw
 * readings only (interval.ts `roseAgg`). Pure.
 */
import type { ObservationRow } from '../api'
import { windRoseRequest, type WindRoseRequest } from '../cards/windRose'
import { windRoseTitle } from '../charts/windRose'
import { newestStamp, rowsWithin, windRoseStats, type WindRoseModel } from '../models/windRose'
import type { UrlState } from '../url-schema'
import { rawMinutes } from './interval'
import { last24h, type PageRange } from './range'

/** The one variable page that offers the Rose view. */
export const ROSE_VARIABLE = 'wind_dir'

/** The page's view switch, in order: the time series (the key absent), then the rose. */
export const WIND_VIEW_CHIPS = [
  { id: 'series', label: 'Time series' },
  { id: 'rose', label: 'Rose' },
] as const
export type WindViewChip = (typeof WIND_VIEW_CHIPS)[number]['id']

/** Why All years is off beside the rose (shown under the range chips). */
export const ROSE_ALL_YEARS_REASON = 'All years is a time series only; the rose shows one date window.'

/** The range chips beside the rose: every window, not All years (ROSE_ALL_YEARS_REASON). */
export const roseOffersRange = (id: string): boolean => id !== 'all'

/** The page for variable `id` offers the switch. */
export const offersRose = (id: string | null | undefined): boolean => id === ROSE_VARIABLE

/** The page shows the rose: `wd=rose` on the Wind direction page; All years (`view=history`, an old link) shows its time series. */
export const showsRose = (state: Pick<UrlState, 'wd' | 'view'>, id: string | null | undefined): boolean =>
  offersRose(id) && state.wd === 'rose' && state.view !== 'history'

/** URL patch for the switch: the rose leaves All years for the default window; the time series clears the key. */
export const windViewPatch = (id: WindViewChip): Partial<UrlState> => (id === 'rose' ? { wd: 'rose', view: 'recent' } : { wd: null })

/** The rose's request: wind speed + direction over the window's local dates at its interval. */
export const roseRequest = (station: string, start: string, end: string, agg: 'raw' | 'hourly'): WindRoseRequest => windRoseRequest(station, start, end, agg)

/** The rows the rose draws: the 24 hours up to the newest reading for the 24 h chip (as its time series shows), else every row. */
export function roseRows(rows: readonly ObservationRow[], range: PageRange): readonly ObservationRow[] {
  if (range !== '24h') return rows
  const last = newestStamp(rows)
  return last === null ? [] : rowsWithin(rows, last24h(last))
}

/** Live-region text once the rose shows a new window: what it covers and where the wind came from most. */
export function roseAnnouncement(station: string, m: WindRoseModel, range: PageRange, agg: 'raw' | 'hourly', network?: string | null): string {
  const n = m.n + m.calm
  const word = agg === 'raw' ? `${rawMinutes(network)}-minute` : 'hourly'
  const from = m.n === 0 ? 'calm throughout' : `most often from ${windRoseStats(m)[0].value}`
  return `Wind rose updated: ${station}, ${windRoseTitle(m, range === '24h') ?? 'wind'}, ${n.toLocaleString('en-US')} ${word} readings, ${from}.`
}
