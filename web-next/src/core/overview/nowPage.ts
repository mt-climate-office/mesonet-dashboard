/**
 * The Now page in one call (partials/now, ui/now/nowView.ts): the hero
 * (hero.ts), the tiles `nowTiles` selects, formatted here and only here with
 * plain names, units and precision from core/variables/labels (sparkline
 * sentences included), the forecast-period icons, and the meta lines of the
 * "All readings" and "Station details" rows. Precipitation is summarised once
 * per page. Also the one extra request behind the soil Dry/Wet chip. Pure.
 */
import { derivedSwpRequest, type ObservationRow, type Station } from '../api'
import { metersToFeet } from '../about/details'
import type { StripPeriod } from '../charts/heroStrip'
import { sparkline, type Sparkline, type SparkSeries } from '../charts/sparkline'
import { parseWallClock } from '../sensorEvents'
import { compassWord, formatReading, formatValue, LABELS } from '../variables/labels'
import { readConditions, type Conditions } from './conditions'
import { buildHero, type HeroInput, type HeroView } from './hero'
import { nowPrecip, type PrecipSummary } from './precip'
import { ytdNormal } from './normals'
import { dewPointF, nowTiles, pressureChange3h, pressureTrend, shallowestSwpBar, soilState, type SoilState } from './relevance'
import { rainBars } from './rainBars'
import { sparkSeries, type SeriesKey } from './series'
import { hasSnow } from './snow'
import type { Tile, TileId } from './tiles'

export interface NowPageInput extends HeroInput {
  /** Shallowest soil water potential (bar, `latestSwpBar`), when fetched; else no Dry/Wet chip. */
  swpBar?: number | null
  /** Daily precipitation for the last 7 days (`rainDailyQuery`), or undefined until loaded: the Rain tile's bars. */
  rainDaily?: readonly ObservationRow[]
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

/** The tile's number: `/latest`, or for Rain the 7 d total with the ppt summary, else 24 h. */
function reading(id: TileId, c: Conditions, p: PrecipSummary): number | null {
  const m: Record<TileId, number | null> = { wind: c.windMph, precip: p.last7d ?? p.last24h, rh: c.rh, solar: c.solar, soil: c.soil[0]?.vwc ?? null, snow: c.snowIn, vpd: c.vpdMb }
  return m[id]
}

/** The line under the value: "SSE · gusts 12", "Last 7 days · 87% of normal this year", "Dew point 49°", "2 in deep", or "". */
function sub(id: TileId, c: Conditions, input: NowPageInput, p: PrecipSummary): string {
  if (id === 'wind') return [c.windDeg === null ? null : compassWord(c.windDeg), c.gustMph === null ? null : `gusts ${formatValue('windgust', c.gustMph)}`].filter(Boolean).join(' · ')
  if (id === 'precip') {
    const normal = input.normals.pr ? ytdNormal(input.normals.pr, input.today) : null
    const ytd = p.ytd !== null && normal ? `${Math.round((p.ytd / normal) * 100)}% of normal this year` : null
    return [p.last7d !== null ? 'Last 7 days' : 'Last 24 hours', ytd].filter(Boolean).join(' · ')
  }
  if (id === 'rh') {
    const dp = dewPointF(c.airF, c.rh)
    return dp === null ? '' : `Dew point ${formatValue('air_temp', dp)}°`
  }
  if (id === 'soil' && c.soil[0]) return `${c.soil[0].depthIn} in deep`
  return ''
}

/** The 48 h sparkline in `v`'s plain unit and display precision, or none. */
function spark(s: SparkSeries | undefined, v: string): { spark: Sparkline | null; sparkLabel: string } {
  const g = s ? sparkline(s, { kind: 'line' }) : null
  if (!s || !g) return { spark: null, sparkLabel: '' }
  const vals = s.v.filter((x): x is number => x !== null)
  return { spark: g, sparkLabel: `Last 48 hours: from ${formatValue(v, Math.min(...vals))} to ${formatReading(v, Math.max(...vals))}.` }
}

function tileView(t: Tile, c: Conditions, input: NowPageInput, p: PrecipSummary, series: Partial<Record<SeriesKey, SparkSeries>>): NowTileView {
  // Rain draws 7 daily bars, or nothing in a dry week (rainBars), not the 48 h hourly line.
  const g = t.id === 'precip' ? (rainBars(input.rainDaily, input.today) ?? { spark: null, sparkLabel: '' }) : spark(series[t.series], t.v)
  return {
    id: t.id,
    v: t.v,
    name: LABELS[t.v].name,
    value: formatValue(t.v, reading(t.id, c, p)),
    unit: LABELS[t.v].unit,
    sub: sub(t.id, c, input, p),
    chip: t.id === 'soil' ? soilState(input.swpBar) : null,
    spark: g.spark,
    sparkLabel: g.sparkLabel,
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
  const p = nowPrecip(input)
  const hero = buildHero(input, p)
  const icons = (hero.strip?.periods ?? []).filter((x) => x.icon !== null)
  const base = { hero, icons, stationMeta: stationMeta(input.station) }
  if (!input.latest) return { ...base, tiles: [], readingsMeta: '' }
  const c = readConditions(input.latest)
  const series = input.hourly ? sparkSeries(input.hourly) : {}
  const tiles = nowTiles(input, p).map((t) => tileView(t, c, input, p, series))
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
