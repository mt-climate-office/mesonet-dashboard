/**
 * Pure rules for what the Now page shows: the tiles (sunlight only by day),
 * pressure as a 3 h trend instead of a tile, the dew point under humidity and
 * a Dry/Wet soil state from soil water potential. Snow keeps its own rule
 * (snow.ts). nowPage.ts formats the result.
 */
import type { ObservationRow } from '../api'
import { parseWallClock } from '../sensorEvents'
import { SWP_FIELD_CAPACITY, SWP_WILTING_POINT } from '../ag/view/labels'
import { readConditions } from './conditions'
import { nowPrecip, type PrecipSummary } from './precip'
import { reportedTiles, type OverviewInput, type Tile } from './tiles'

/**
 * Below this (W/m²) the sun is down. Pyranometers read 0–2 W/m² at night;
 * daylight under heavy overcast is still tens of W/m².
 */
export const SUN_DOWN_WM2 = 5

/** True when a solar reading (W/m²) means daylight. */
export const sunUp = (solar: number | null): boolean => solar !== null && solar >= SUN_DOWN_WM2

/**
 * Dew point in °F from °F and RH (%), by the Magnus formula with the
 * Alduchov–Eskridge constants (a = 17.625, b = 243.04 °C; ±0.4 °C from
 * −40 to 50 °C). Null when either input is missing or RH ≤ 0.
 */
export function dewPointF(airF: number | null, rh: number | null): number | null {
  if (airF === null || rh === null || !(rh > 0)) return null
  const t = ((airF - 32) * 5) / 9
  const g = Math.log(Math.min(rh, 100) / 100) + (17.625 * t) / (243.04 + t)
  return ((243.04 * g) / (17.625 - g)) * 9 / 5 + 32
}

export type PressureTrend = 'rising' | 'falling' | 'steady'

/** A change within ±this many mb over 3 h reads "steady" (NWS practice). */
export const PRESSURE_STEADY_MB = 1

/** Trend word for a 3 h pressure change (mb): steady within ±1 mb inclusive. */
export function pressureTrend(changeMb: number): PressureTrend {
  return changeMb > PRESSURE_STEADY_MB ? 'rising' : changeMb < -PRESSURE_STEADY_MB ? 'falling' : 'steady'
}

const H3 = 3 * 3_600_000

/**
 * The 3 h pressure change (mb) from the hourly rows: the newest finite
 * `Atmospheric Pressure` reading minus the one exactly 3 h earlier; null
 * when either is missing.
 */
export function pressureChange3h(rows: readonly ObservationRow[] | undefined): number | null {
  const byT = new Map<number, number>()
  for (const r of rows ?? []) {
    const t = parseWallClock(r.datetime)
    const col = Object.keys(r).find((k) => k.startsWith('Atmospheric Pressure'))
    const v = col === undefined ? null : r[col]
    if (t !== null && typeof v === 'number' && Number.isFinite(v)) byT.set(t, v)
  }
  if (!byT.size) return null
  const end = Math.max(...byT.keys())
  const before = byT.get(end - H3)
  return before === undefined ? null : byT.get(end)! - before
}

export type SoilState = 'Dry' | 'Wet'

/**
 * Soil state from soil water potential (bar, positive magnitude as `/derived`
 * sends it): "Wet" at or wetter than field capacity (≤ 0.33 bar), "Dry" at or
 * past the wilting point (≥ 15 bar), else none. These are the standard
 * agronomic thresholds the Ag SWP chart draws. Volumetric water content
 * alone gets no state: its field capacity and wilting point depend on the
 * soil texture at each station and depth, so no single VWC cut-off is defensible.
 */
export function soilState(swpBar: number | null | undefined): SoilState | null {
  if (swpBar == null || !Number.isFinite(swpBar)) return null
  return swpBar <= SWP_FIELD_CAPACITY ? 'Wet' : swpBar >= SWP_WILTING_POINT ? 'Dry' : null
}

const SWP_COL = /^Soil Water Potential @ -?(\d+) cm \[bar\]$/

/** The shallowest finite SWP (bar) in one `/derived` row (raw headers), or null. */
export function shallowestSwpBar(row: Record<string, unknown> | undefined): number | null {
  let best: [number, number] | null = null
  for (const [k, v] of Object.entries(row ?? {})) {
    const m = SWP_COL.exec(k)
    if (m && typeof v === 'number' && Number.isFinite(v) && (!best || +m[1] < best[0])) best = [+m[1], v]
  }
  return best ? best[1] : null
}

/**
 * The Now tiles, in page order: what the station reports (`reportedTiles`;
 * Rain whenever there is a source, even in a dry week, for its YTD line),
 * minus Sunlight at night (`sunUp`). Pressure is never a tile (its 3 h trend
 * is text). `p` is the page's one precipitation summary.
 */
export function nowTiles(input: OverviewInput, p: PrecipSummary = nowPrecip(input)): Tile[] {
  if (!input.latest) return []
  const c = readConditions(input.latest)
  return reportedTiles(c, input.hourly, p).filter((t) => t.id !== 'solar' || sunUp(c.solar))
}

