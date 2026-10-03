/**
 * Which Now tiles a station reports, and the header freshness, from `/latest`
 * (tier 1) and the 72 h hourly rows (tier 2). Formatting is nowPage.ts's alone
 * (names, units and precision from core/variables/labels). Snow depth shows
 * only when there is snow (snow.ts); relevance.ts drops what means nothing.
 */
import type { ObservationRow, PptSummaryRow } from '../api'
import type { NormalRow } from '../normals'
import type { Conditions } from './conditions'
import type { PrecipSummary } from './precip'
import type { SeriesKey } from './series'
import { hasSnow } from './snow'
import { isStale, updatedText } from './stamp'

export interface OverviewInput {
  /** First `/latest` row, or undefined while loading / on failure. */
  latest: Record<string, unknown> | undefined
  /** The 72 h hourly rows (tier 2), or undefined until loaded. */
  hourly: readonly ObservationRow[] | undefined
  /** `/derived/ppt/` row (HydroMet only). */
  ppt: PptSummaryRow | undefined
  normals: { tmmx?: readonly NormalRow[]; tmmn?: readonly NormalRow[]; pr?: readonly NormalRow[] }
  /** Today in Denver (core/today), YYYY-MM-DD. */
  today: string
  nowMs: number
}

export interface Freshness {
  updated: string
  stale: boolean
  provisional: boolean
}

export type TileId = 'wind' | 'precip' | 'rh' | 'solar' | 'soil' | 'snow' | 'vpd'

export interface Tile {
  id: TileId
  /** Charts `v=` id the tile opens; its `LABELS` entry names and formats it. */
  v: string
  /** The 48 h sparkline series (Rain draws its daily bars instead). */
  series: SeriesKey
}

/** Every tile, in page order. */
export const TILES: readonly Tile[] = [
  { id: 'wind', v: 'wind_spd', series: 'wind' },
  { id: 'precip', v: 'ppt', series: 'ppt' },
  { id: 'rh', v: 'rh', series: 'rh' },
  { id: 'solar', v: 'sol_rad', series: 'solar' },
  { id: 'soil', v: 'soil_vwc', series: 'soil' },
  { id: 'snow', v: 'snow_depth', series: 'snow' },
  { id: 'vpd', v: 'vpd_atmo', series: 'vpd' },
]

/** "Updated 7 min ago", stale after 2 h, provisional; null without a parseable stamp. */
export function freshness(c: Conditions, nowMs: number): Freshness | null {
  if (c.stampMs === null) return null
  return { updated: updatedText(c.stamp, c.stampMs, nowMs), stale: isStale(c.stampMs, nowMs), provisional: c.provisional }
}

/** The tiles the station reports now, in page order: Rain with any precipitation source (`p`), snow by `hasSnow`. */
export function reportedTiles(c: Conditions, hourly: readonly ObservationRow[] | undefined, p: PrecipSummary): Tile[] {
  const has: Record<TileId, boolean> = {
    wind: c.windMph !== null,
    precip: p.sinceMidnight !== null || p.last24h !== null || p.ytd !== null,
    rh: c.rh !== null,
    solar: c.solar !== null,
    soil: c.soil.length > 0,
    snow: c.snowIn !== null && hasSnow(c.snowIn, hourly),
    vpd: c.vpdMb !== null,
  }
  return TILES.filter((t) => has[t.id])
}
