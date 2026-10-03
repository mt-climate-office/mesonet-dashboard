/**
 * Which readings the Now page shows, and how: the tiles from `buildOverview`
 * filtered and reshaped by pure rules (sunlight only by day, precipitation
 * folded into one Rain tile, pressure as a 3 h trend instead of a tile, snow
 * by its existing rule, dew point under humidity, a Dry/Wet soil state from
 * soil water potential when the caller has it).
 */
import type { ObservationRow } from '../api'
import { parseWallClock } from '../sensorEvents'
import { SWP_FIELD_CAPACITY, SWP_WILTING_POINT } from '../ag/view/labels'
import { readConditions } from './conditions'
import { ytdNormal } from './normals'
import { precipSummary } from './precip'
import { hourlyPrecip } from './series'
import { buildOverview, type OverviewInput, type Tile } from './tiles'

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

export interface NowTilesInput extends OverviewInput {
  /** Shallowest-depth soil water potential (bar), when the caller fetched it; else no soil state. */
  swpBar?: number | null
}

const deg = (v: number) => `${Math.round(v)}°`

/** The Rain tile: 7 d total (24 h without the ppt summary) and the YTD share of normal. */
function rainTile(t: Tile, input: OverviewInput): Tile {
  const p = precipSummary(input.ppt, input.hourly ? hourlyPrecip(input.hourly, input.today) : null)
  const normal = input.normals.pr ? ytdNormal(input.normals.pr, input.today) : null
  const week = p.last7d !== null
  const v = week ? p.last7d : p.last24h
  const ytd = p.ytd !== null && normal ? `${Math.round((p.ytd / normal) * 100)}% of normal this year` : null
  return { ...t, label: week ? 'Rain · 7 days' : 'Rain · 24 hours', value: v === null ? '—' : v.toFixed(2), detail: ytd ? [ytd] : [] }
}

/**
 * The Now tiles, in `buildOverview` order: no sunlight tile at night
 * (`sunUp`), no pressure tile (use `pressureChange3h` + `pressureTrend`),
 * precipitation as the Rain tile (shown whenever there is a source, even
 * with a dry week, for the YTD line), humidity with the dew point, soil with
 * `state` when `swpBar` gives one. Snow keeps `hasSnow`.
 */
export function nowTiles(input: NowTilesInput): Tile[] {
  const tiles = buildOverview(input).tiles
  if (!input.latest) return tiles
  const c = readConditions(input.latest)
  const out: Tile[] = []
  for (const t of tiles) {
    if (t.id === 'pressure' || (t.id === 'solar' && !sunUp(c.solar))) continue
    if (t.id === 'precip') out.push(rainTile(t, input))
    else if (t.id === 'rh') {
      const dp = dewPointF(c.airF, c.rh)
      out.push(dp === null ? t : { ...t, detail: [...t.detail, `Dew point ${deg(dp)}`] })
    } else if (t.id === 'soil') {
      const state = soilState(input.swpBar)
      out.push(state ? { ...t, state } : t)
    } else out.push(t)
  }
  return out
}
