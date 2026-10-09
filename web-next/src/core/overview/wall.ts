/**
 * Now's chart wall (wide screens): beside the hero and tiles, the last 7 days of up to six of the
 * station's variables, one small chart each, then About's details and map. Which variables, the
 * window and interval, and when the wall shows are here; ui/now/chartWall.ts fetches and draws.
 */
import type { LatestTimeseriesModel } from '../charts/latestTimeseries'
import type { Variable } from '../variables/catalog'
import { autoAgg } from '../variables/interval'
import { presetWindow } from '../variables/range'
import { denverDay } from '../today'
import type { LatestAgg } from '../url-schema'

/** The space Now needs for the wall (the width beside the station drawer, CSS px), and a screen tall enough for it. */
export const WALL_MIN_WIDTH = 1760
export const WALL_MIN_HEIGHT = 561
export const showsWall = (width: number, height: number): boolean => width >= WALL_MIN_WIDTH && height >= WALL_MIN_HEIGHT

/** The wall's variables in order of preference (`v=` ids); a station shows the first WALL_SIZE it reports. */
export const WALL_PREFERENCE = ['air_temp', 'ppt', 'wind_spd', 'rh', 'soil_vwc', 'soil_temp', 'sol_rad', 'bp'] as const
export const WALL_SIZE = 6

/** The station's wall variables: WALL_PREFERENCE order, those it reports, at most WALL_SIZE. */
export function wallVariables(vars: readonly Variable[]): Variable[] {
  const byId = new Map(vars.map((v) => [v.id, v]))
  return WALL_PREFERENCE.flatMap((id) => byId.get(id) ?? []).slice(0, WALL_SIZE)
}

/** The wall's range chip: its charts are the variable pages' "7 d" window, at that window's Auto interval. */
export const WALL_RANGE = '7d' as const

/** The wall's window (YYYY-MM-DD, local; `today` injectable for tests) and interval. */
export function wallWindow(today = denverDay()): { start: string; end: string; valid: true; agg: LatestAgg } {
  const w = presetWindow(WALL_RANGE, today)
  return { ...w, valid: true, agg: autoAgg(7) }
}

/** One variable's chart from the wall's model (one panel per variable, by display name); null without its panel. */
export function wallPanel(m: LatestTimeseriesModel | null, name: string): LatestTimeseriesModel | null {
  const p = m?.ts.panels.find((x) => x.variable === name)
  return m && p ? { ...m, ts: { ...m.ts, panels: [p] } } : null
}
