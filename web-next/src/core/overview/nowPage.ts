/**
 * The Now page in one call (partials/now, ui/now/nowView.ts): the hero
 * (hero.ts), the tiles `nowTiles` selects, reshaped for display with plain
 * names, units and precision from core/variables/labels, the forecast-period
 * icons, and the meta lines of the "All readings" and "Station details" rows.
 * Also the one extra request behind the soil Dry/Wet chip. Pure.
 */
import { derivedSwpRequest, type Station } from '../api'
import { metersToFeet } from '../about/details'
import type { StripPeriod } from '../charts/heroStrip'
import type { Sparkline } from '../charts/sparkline'
import { parseWallClock } from '../sensorEvents'
import { variableId } from '../variables/catalog'
import { compassWord, formatReading, formatValue, LABELS, plainName } from '../variables/labels'
import { readConditions, type Conditions } from './conditions'
import { buildHero, type HeroInput, type HeroView } from './hero'
import { precipSummary } from './precip'
import { nowTiles, pressureChange3h, pressureTrend, shallowestSwpBar, type SoilState } from './relevance'
import { hourlyPrecip } from './series'
import { hasSnow } from './snow'
import type { Tile, TileId } from './tiles'

export interface NowPageInput extends HeroInput {
  /** Shallowest soil water potential (bar, `latestSwpBar`), when fetched; else no Dry/Wet chip. */
  swpBar?: number | null
  /** The station row, for the "Station details" meta. */
  station: Pick<Station, 'sub_network' | 'elevation'>
}

export interface NowTileView {
  id: TileId
  /** Charts `v=` id the tile opens. */
  v: string
  /** Plain name ("Wind", "Humidity", "Rain"). */
  name: string
  /** The number at the variable's display precision ("7", "0.05"), '—' when missing. */
  value: string
  unit: string
  /** One secondary line ("SSE · gusts 12", "Dew point 38°", "Last 7 days · 87% of normal this year"), or "". */
  sub: string
  /** Soil only: "Dry"/"Wet" from soil water potential, else null. */
  chip: SoilState | null
  spark: Sparkline | null
  sparkLabel: string
}

export interface NowPage {
  hero: HeroView
  tiles: NowTileView[]
  /** Strip periods with an api.weather.gov icon, for the row under the strip. */
  icons: StripPeriod[]
  /** "Pressure 847 mb, steady · Snow none" ("" when neither is reported). */
  readingsMeta: string
  /** "HydroMet · 4,905 ft". */
  stationMeta: string
}

/** The tile's number from `/latest`; null for Rain (its window depends on the source, see `rain`). */
function reading(id: TileId, c: Conditions): number | null {
  const m: Partial<Record<TileId, number | null>> = { wind: c.windMph, rh: c.rh, solar: c.solar, pressure: c.pressureMb, soil: c.soil[0]?.vwc ?? null, snow: c.snowIn, vpd: c.vpdMb }
  return m[id] ?? null
}

/** Rain: the 7 d total with the ppt summary, else 24 h (as `nowTiles` labels it). */
function rain(input: NowPageInput): { value: number | null; window: string } {
  const p = precipSummary(input.ppt, input.hourly ? hourlyPrecip(input.hourly, input.today) : null)
  return p.last7d !== null ? { value: p.last7d, window: 'Last 7 days' } : { value: p.last24h, window: 'Last 24 hours' }
}

function sub(t: Tile, c: Conditions, window: string): string {
  if (t.id === 'wind') {
    const parts = [c.windDeg === null ? null : compassWord(c.windDeg), c.gustMph === null ? null : `gusts ${formatValue('windgust', c.gustMph)}`]
    return parts.filter(Boolean).join(' · ')
  }
  if (t.id === 'precip') return [window, ...t.detail].join(' · ')
  if (t.id === 'soil' && c.soil[0]) return `${c.soil[0].depthIn} in deep`
  return t.detail.join(' · ')
}

function tileView(t: Tile, c: Conditions, input: NowPageInput): NowTileView {
  const v = variableId(t.vars[0])
  const r = t.id === 'precip' ? rain(input) : { value: reading(t.id, c), window: '' }
  return {
    id: t.id,
    v,
    name: plainName(v, t.label),
    value: formatValue(v, r.value),
    unit: LABELS[v]?.unit ?? t.unit,
    sub: sub(t, c, r.window),
    chip: t.state ?? null,
    spark: t.spark,
    sparkLabel: t.sparkLabel,
  }
}

/** "Pressure 847 mb, steady" (trend once the hourly rows are in) and "Snow none" / "Snow 3.2 in" where reported. */
function readingsMeta(c: Conditions, input: NowPageInput): string {
  const parts: string[] = []
  if (c.pressureMb !== null) {
    const d = pressureChange3h(input.hourly)
    parts.push(`Pressure ${formatReading('bp', c.pressureMb)}${d === null ? '' : `, ${pressureTrend(d)}`}`)
  }
  if (c.snowIn !== null) parts.push(hasSnow(c.snowIn, input.hourly) ? `Snow ${formatReading('snow_depth', Math.max(0, c.snowIn))}` : 'Snow none')
  return parts.join(' · ')
}

/** "HydroMet · 4,905 ft"; parts that are missing are left out. */
export function stationMeta(s: Pick<Station, 'sub_network' | 'elevation'>): string {
  const ft = Number.isFinite(s.elevation) ? `${metersToFeet(s.elevation).toLocaleString('en-US')} ft` : null
  return [s.sub_network, ft].filter(Boolean).join(' · ')
}

/** The whole Now page; tiles and the readings meta are empty until `/latest` arrives. */
export function buildNowPage(input: NowPageInput): NowPage {
  const hero = buildHero(input)
  const icons = (hero.strip?.periods ?? []).filter((p) => p.icon !== null)
  const base = { hero, icons, stationMeta: stationMeta(input.station) }
  if (!input.latest) return { ...base, tiles: [], readingsMeta: '' }
  const c = readConditions(input.latest)
  const tiles = nowTiles(input).map((t) => tileView(t, c, input))
  return { ...base, tiles, readingsMeta: readingsMeta(c, input) }
}

/**
 * The request behind the soil chip: `/derived/hourly` SWP from yesterday
 * through `today` (local dates) at QC level 2, raw headers. `key` encodes
 * every input. Only for stations with SWP sensors (`stationHasSwp`).
 */
export function nowSwpQuery(station: string, today: string) {
  const [y, m, d] = today.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  return {
    key: `swp:${station}:hourly:${start}:${today}:l2`,
    request: derivedSwpRequest({ station, start, end: today, time: 'hourly', level: 2 }),
  }
}

/** The shallowest SWP (bar) of the newest row that has one, or null. */
export function latestSwpBar(rows: readonly Record<string, unknown>[] | undefined): number | null {
  let best: [number, number] | null = null
  for (const r of rows ?? []) {
    const t = parseWallClock(r.datetime)
    const v = shallowestSwpBar(r)
    if (t !== null && v !== null && (!best || t > best[0])) best = [t, v]
  }
  return best ? best[1] : null
}
