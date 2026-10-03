/**
 * The Now overview model: header freshness, the air-temperature hero and the
 * tile list, built from the tier-1 data (`/latest`, `/derived/ppt/`) and the
 * tier-2 data (72 h hourly, normals) when they arrive. Display strings are
 * formatted here so the partial only binds text. A tile is shown only when
 * the station reports its value; snow depth only when there is snow (snow.ts).
 */
import type { ObservationRow, PptSummaryRow } from '../api'
import { sparkline, type Sparkline, type SparkSeries } from '../charts/sparkline'
import type { NormalRow } from '../normals'
import { degToCompass } from '../params'
import { feelsLikeF, readConditions, type Conditions, type SoilDepth } from './conditions'
import { normalMedianOn, ytdNormal } from './normals'
import type { SoilState } from './relevance'
import { precipSummary } from './precip'
import { hourlyPrecip, sparkSeries, todayHighLow, type SeriesKey } from './series'
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
  /** Local (Mountain) date, YYYY-MM-DD. */
  today: string
  nowMs: number
}

export interface Freshness {
  updated: string
  stale: boolean
  provisional: boolean
}

export interface Hero {
  temp: string
  feels: string | null
  /** "Wind chill" / "Heat index"; null when feels-like is the air temperature. */
  feelsKind: string | null
  /** "High 63° · Low 41°" today, or null before the hourly data. */
  highLow: string | null
  /** "Normal 67° / 38°", or null without normals. */
  normal: string | null
  spark: Sparkline | null
  sparkLabel: string
}

export type TileId = 'wind' | 'precip' | 'rh' | 'solar' | 'pressure' | 'soil' | 'snow' | 'vpd'

export interface Tile {
  id: TileId
  label: string
  value: string
  unit: string
  /** Secondary lines ("Gust 19 mph"). */
  detail: string[]
  /** Latest/Compare display variables the tile links to. */
  vars: string[]
  spark: Sparkline | null
  /** Screen-reader text for the sparkline ("" when there is none). */
  sparkLabel: string
  /** Wind: the direction the wind blows FROM (deg), for the compass glyph. */
  windDeg?: number
  /** Soil: the depth profile. */
  soil?: SoilRowView[]
  /** Soil on Now: "Dry"/"Wet" from soil water potential (relevance.ts `soilState`), when known. */
  state?: SoilState
}

export interface SoilRowView {
  depth: string
  temp: string
  vwc: string
  /** VWC as a 0–100 bar width (% of a 50 % scale, capped). */
  bar: number
}

export interface Overview {
  freshness: Freshness | null
  hero: Hero | null
  tiles: Tile[]
}

const fx = (v: number, d: number) => v.toFixed(d)
const deg = (v: number) => `${Math.round(v)}°`
const inch = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)} in`)

const SPARK: Record<SeriesKey, { unit: string; digits: number; bars?: boolean }> = {
  air: { unit: '°F', digits: 0 },
  rh: { unit: '%', digits: 0 },
  wind: { unit: 'mph', digits: 0 },
  ppt: { unit: 'in', digits: 2, bars: true },
  solar: { unit: 'W/m²', digits: 0 },
  pressure: { unit: 'mbar', digits: 1 },
  soil: { unit: '%', digits: 1 },
  snow: { unit: 'in', digits: 1 },
  vpd: { unit: 'mbar', digits: 1 },
}

/** Sparkline geometry plus its screen-reader sentence for one series key. */
function spark(series: Partial<Record<SeriesKey, SparkSeries>>, key: SeriesKey): { spark: Sparkline | null; sparkLabel: string } {
  const s = series[key]
  const cfg = SPARK[key]
  const g = s ? sparkline(s, { kind: cfg.bars ? 'bars' : 'line' }) : null
  if (!s || !g) return { spark: null, sparkLabel: '' }
  const vals = s.v.filter((v): v is number => v !== null)
  const label = cfg.bars
    ? `Last 48 hours: ${fx(vals.reduce((a, b) => a + b, 0), cfg.digits)} ${cfg.unit} in total.`
    : `Last 48 hours: from ${fx(Math.min(...vals), cfg.digits)} to ${fx(Math.max(...vals), cfg.digits)} ${cfg.unit}.`
  return { spark: g, sparkLabel: label }
}

function soilRows(soil: SoilDepth[]): SoilRowView[] {
  return soil.map((d) => ({
    depth: `${d.depthIn} in`,
    temp: d.tempF === null ? '—' : deg(d.tempF),
    vwc: d.vwc === null ? '—' : `${fx(d.vwc, 1)}%`,
    bar: d.vwc === null ? 0 : Math.max(0, Math.min(100, (d.vwc / 50) * 100)),
  }))
}

function freshness(c: Conditions, nowMs: number): Freshness | null {
  if (c.stampMs === null) return null
  return { updated: updatedText(c.stamp, c.stampMs, nowMs), stale: isStale(c.stampMs, nowMs), provisional: c.provisional }
}

function hero(c: Conditions, input: OverviewInput, series: Partial<Record<SeriesKey, SparkSeries>>): Hero | null {
  if (c.airF === null) return null
  const fl = feelsLikeF(c.airF, c.rh, c.windMph)
  const hl = input.hourly ? todayHighLow(input.hourly, input.today) : null
  const hi = hl ? Math.max(hl.hi, c.airF) : null
  const lo = hl ? Math.min(hl.lo, c.airF) : null
  const nHi = input.normals.tmmx ? normalMedianOn(input.normals.tmmx, input.today) : null
  const nLo = input.normals.tmmn ? normalMedianOn(input.normals.tmmn, input.today) : null
  return {
    temp: deg(c.airF),
    feels: fl ? `Feels like ${deg(fl.valueF)}` : null,
    feelsKind: fl?.regime === 'wind_chill' ? 'Wind chill' : fl?.regime === 'heat_index' ? 'Heat index' : null,
    highLow: hi !== null && lo !== null ? `High ${deg(hi)} · Low ${deg(lo)}` : null,
    normal: nHi !== null && nLo !== null ? `Normal ${deg(nHi)} / ${deg(nLo)}` : null,
    ...spark(series, 'air'),
  }
}

function tiles(c: Conditions, input: OverviewInput, series: Partial<Record<SeriesKey, SparkSeries>>): Tile[] {
  const out: Tile[] = []
  const add = (t: Omit<Tile, 'spark' | 'sparkLabel'>, key: SeriesKey) => out.push({ ...t, ...spark(series, key) })

  if (c.windMph !== null) {
    const detail = [c.gustMph !== null ? `Gust ${Math.round(c.gustMph)} mph` : null, c.windDeg !== null ? `From ${degToCompass(c.windDeg)} ${deg(c.windDeg)}` : null]
    add({ id: 'wind', label: 'Wind', value: String(Math.round(c.windMph)), unit: 'mph', detail: detail.filter((x): x is string => !!x), vars: ['Wind Speed'], ...(c.windDeg !== null ? { windDeg: c.windDeg } : {}) }, 'wind')
  }

  const p = precipSummary(input.ppt, input.hourly ? hourlyPrecip(input.hourly, input.today) : null)
  if (p.sinceMidnight !== null || p.last24h !== null || p.ytd !== null) {
    const normal = input.normals.pr ? ytdNormal(input.normals.pr, input.today) : null
    const ytd = p.ytd === null ? null : `Year to date ${inch(p.ytd)}${normal ? ` · ${Math.round((p.ytd / normal) * 100)}% of normal` : ''}`
    const detail = [`24 h ${inch(p.last24h)}${p.last7d === null ? '' : ` · 7 d ${inch(p.last7d)}`}`, ytd]
    add({ id: 'precip', label: 'Precipitation today', value: p.sinceMidnight === null ? '—' : fx(p.sinceMidnight, 2), unit: 'in', detail: detail.filter((x): x is string => !!x), vars: ['Precipitation'] }, 'ppt')
  }

  if (c.rh !== null) add({ id: 'rh', label: 'Humidity', value: String(Math.round(c.rh)), unit: '%', detail: [], vars: ['Relative Humidity'] }, 'rh')
  if (c.solar !== null) add({ id: 'solar', label: 'Solar radiation', value: String(Math.round(c.solar)), unit: 'W/m²', detail: [], vars: ['Solar Radiation'] }, 'solar')
  if (c.pressureMb !== null) add({ id: 'pressure', label: 'Pressure', value: fx(c.pressureMb, 1), unit: 'mbar', detail: [], vars: ['Atmospheric Pressure'] }, 'pressure')
  if (c.soil.length) {
    const top = c.soil[0]
    add({ id: 'soil', label: `Soil moisture · ${top.depthIn} in`, value: top.vwc === null ? '—' : fx(top.vwc, 1), unit: '%', detail: [], vars: ['Soil VWC', 'Soil Temperature'], soil: soilRows(c.soil) }, 'soil')
  }
  if (c.snowIn !== null && hasSnow(c.snowIn, input.hourly)) add({ id: 'snow', label: 'Snow depth', value: fx(c.snowIn, 1), unit: 'in', detail: [], vars: ['Snow Depth'] }, 'snow')
  if (c.vpdMb !== null) add({ id: 'vpd', label: 'Vapor pressure deficit', value: fx(c.vpdMb, 1), unit: 'mbar', detail: [], vars: ['VPD'] }, 'vpd')
  return out
}

/** The whole overview; empty (null header and hero, no tiles) until `/latest` arrives. */
export function buildOverview(input: OverviewInput): Overview {
  if (!input.latest) return { freshness: null, hero: null, tiles: [] }
  const c = readConditions(input.latest)
  const series = input.hourly ? sparkSeries(input.hourly) : {}
  return { freshness: freshness(c, input.nowMs), hero: hero(c, input, series), tiles: tiles(c, input, series) }
}
