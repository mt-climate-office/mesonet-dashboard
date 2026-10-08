/**
 * The Now page in one call (partials/now, ui/now/nowView.ts): the hero
 * (hero.ts), the tiles `nowTiles` selects, formatted here and only here with
 * plain names, units and precision from core/variables/labels (sparkline
 * sentences included), the forecast-period icons, and the meta lines of the
 * "All readings" and "Station details" rows. Precipitation is summarised once
 * per page. Also the one extra request behind the soil Dry/Wet chip. Pure.
 */
import { applyFrozenMask, frozenMask, swp } from '../ag/compute'
import type { SoilParams, SoilSeries } from '../ag/contract'
import { swpBar } from '../ag/view/labels'
import type { ObservationRow, Station } from '../api'
import { metersToFeet } from '../about/details'
import type { StripPeriod } from '../charts/heroStrip'
import { sparkline, type Sparkline, type SparkSeries } from '../charts/sparkline'
import { parseWallClock } from '../sensorEvents'
import { compassWord, formatReading, formatValue, LABELS } from '../variables/labels'
import { readConditions, type Conditions } from './conditions'
import { buildHero, type HeroInput, type HeroView } from './hero'
import { nowPrecip, type PrecipSummary } from './precip'
import { ytdNormal } from './normals'
import { dewPointF, nowTiles, pressureChange3h, pressureTrend, soilState, type SoilState } from './relevance'
import { rainBars } from './rainBars'
import { peakGust, sparkSeries, type SeriesKey } from './series'
import { hasSnow } from './snow'
import { CALM_MPH } from './summary'
import type { Tile, TileId } from './tiles'

export interface NowPageInput extends HeroInput {
  /** Shallowest soil water potential (bar, `latestSwpBar`), when computed; else no Dry/Wet chip. */
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
  /** Wind only: "now · SE" after the unit, beside the 24 h peak gust sub-line; else "". */
  note: string
  /** One secondary line ("Peak gust 43 mph (24 h)", "SSE · gusts 12", "Dew point 38°", "Last 7 days · dry now"), or "". */
  sub: string
  /** Rain only: the year to date against normal ("This year: 87% of normal"), on its own line so it is not read as the value's; else "". */
  detail: string
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

/**
 * Rain now, from the latest report: "0.12 in/h now" (its peak rate, HydroMet), "raining now"
 * (a rate under 0.01 in/h, or no rate column but rain in the interval), "dry now", or "" when
 * the row has neither column.
 */
export function rainNow(c: Pick<Conditions, 'pptIn' | 'pptRateInH'>): string {
  if (c.pptRateInH === null && c.pptIn === null) return ''
  if (c.pptRateInH !== null && c.pptRateInH >= 0.005) return `${formatReading('ppt_max_rate', c.pptRateInH)} now`
  return (c.pptRateInH ?? 0) > 0 || (c.pptIn ?? 0) > 0 ? 'raining now' : 'dry now'
}

/** The line under the value: "SSE · gusts 12" (wind without a 24 h peak gust), "Last 7 days · dry now" (the rain window and `rainNow`), "Dew point 49°", "2 in deep", or "". */
function sub(id: TileId, c: Conditions, p: PrecipSummary): string {
  if (id === 'wind') return [c.windDeg === null ? null : compassWord(c.windDeg), c.gustMph === null ? null : `gusts ${formatValue('windgust', c.gustMph)}`].filter(Boolean).join(' · ')
  if (id === 'precip') return [p.last7d !== null ? 'Last 7 days' : 'Last 24 hours', rainNow(c)].filter(Boolean).join(' · ')
  if (id === 'rh') {
    const dp = dewPointF(c.airF, c.rh)
    return dp === null ? '' : `Dew point ${formatValue('air_temp', dp)}°`
  }
  if (id === 'soil' && c.soil[0]) return `${c.soil[0].depthIn} in deep`
  return ''
}

/** Rain's second line, "This year: 87% of normal" (precipitation since Jan 1 against the normal to date), or "" without either. */
function rainDetail(input: NowPageInput, p: PrecipSummary): string {
  const normal = input.normals.pr ? ytdNormal(input.normals.pr, input.today) : null
  return p.ytd !== null && normal ? `This year: ${Math.round((p.ytd / normal) * 100)}% of normal` : ''
}

/** The 48 h sparkline in `v`'s plain unit and display precision, or none. */
function spark(s: SparkSeries | undefined, v: string): { spark: Sparkline | null; sparkLabel: string } {
  const g = s ? sparkline(s, { kind: 'line' }) : null
  if (!s || !g) return { spark: null, sparkLabel: '' }
  const vals = s.v.filter((x): x is number => x !== null)
  return { spark: g, sparkLabel: `Last 48 hours: from ${formatValue(v, Math.min(...vals))} to ${formatReading(v, Math.max(...vals))}.` }
}

/** Wind with a 24 h peak gust: "7 mph now · SE" (or "Calm", under CALM_MPH) over "Peak gust 43 mph (24 h)"; null keeps the plain tile. */
function windView(c: Conditions, gust: number | null): Pick<NowTileView, 'value' | 'unit' | 'note' | 'sub'> | null {
  if (gust === null) return null
  const sub = `Peak gust ${formatReading('windgust', gust)} (24 h)`
  if (c.windMph !== null && c.windMph < CALM_MPH) return { value: 'Calm', unit: '', note: '', sub }
  return { value: formatValue('wind_spd', c.windMph), unit: LABELS.wind_spd.unit, note: ['now', c.windDeg === null ? null : compassWord(c.windDeg)].filter(Boolean).join(' · '), sub }
}

function tileView(t: Tile, c: Conditions, input: NowPageInput, p: PrecipSummary, series: Partial<Record<SeriesKey, SparkSeries>>, gust: number | null): NowTileView {
  // Rain draws 7 daily bars (a bare baseline in a dry week, rainBars), not the 48 h hourly line.
  const g = t.id === 'precip' ? (rainBars(input.rainDaily, input.today) ?? { spark: null, sparkLabel: '' }) : spark(series[t.series], t.v)
  return {
    id: t.id,
    v: t.v,
    name: LABELS[t.v].name,
    value: formatValue(t.v, reading(t.id, c, p)),
    unit: LABELS[t.v].unit,
    note: '',
    sub: sub(t.id, c, p),
    detail: t.id === 'precip' ? rainDetail(input, p) : '',
    chip: t.id === 'soil' ? soilState(input.swpBar) : null,
    spark: g.spark,
    sparkLabel: g.sparkLabel,
    ...(t.id === 'wind' ? windView(c, gust) : null),
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
  const now = parseWallClock(c.stamp)
  const gust = now === null ? null : peakGust(input.hourly, c.gustMph, now)
  const tiles = nowTiles(input, p).map((t) => tileView(t, c, input, p, series, gust))
  return { ...base, tiles, readingsMeta: readingsMeta(c, input) }
}

/**
 * The request behind the soil chip: hourly level-2 soil VWC (core/ag/data
 * `fetchSoilSeries`) from yesterday through `today` (local dates). `key`
 * encodes every input. Only for stations with SWP parameters (`stationHasSwp`).
 */
export function nowSwpQuery(station: string, today: string) {
  const [y, m, d] = today.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  return {
    key: `soil:${station}:hourly:${start}:${today}:l2`,
    query: { station, start, end: today, period: 'hourly' as const, level: 2 as const },
  }
}

/**
 * The shallowest SWP (bar) of the newest hour that has one, computed in the
 * browser (compute `swp()` over the station's mesonet-soils parameters), or
 * null. Frozen readings are dropped, as on the Ag tab; a dry-end clip reads
 * as its capped lower bound (labels `swpBar`), which is past the wilting point.
 */
export function latestSwpBar(soil: SoilSeries | undefined, params: readonly SoilParams[] | undefined): number | null {
  if (!soil || !params) return null
  const s = swp(soil, [...params])
  const bar = applyFrozenMask(s, swpBar(s).bar, frozenMask(soil))
  const order = s.depthsCm.map((_, d) => d).sort((a, b) => s.depthsCm[a] - s.depthsCm[b])
  for (let i = s.time.length - 1; i >= 0; i--) {
    for (const d of order) {
      const v = bar[d][i]
      if (v != null && Number.isFinite(v)) return v
    }
  }
  return null
}
