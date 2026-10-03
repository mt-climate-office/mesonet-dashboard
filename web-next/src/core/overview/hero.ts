/**
 * Everything the Now hero shows, from one call: the temperature, today's
 * high/low and normal, the one-line summary, the 48 h strip model and the
 * freshness line. Inputs are the overview's data (`/latest`, 72 h hourly
 * rows, `/derived/ppt/`, normals) plus the NWS period and hourly forecasts.
 * "Now" on the strip is the newest observation's wall-clock time.
 */
import type { ForecastPeriod, HourlyForecastPoint, NwsForecast } from '../api'
import type { HeroStripModel, StripPeriod } from '../charts/heroStrip'
import { parseWallClock } from '../sensorEvents'
import { readConditions } from './conditions'
import { precipSummary } from './precip'
import { hourlyPrecip } from './series'
import { daysSinceRain, summarize } from './summary'
import { buildOverview, type Freshness, type OverviewInput } from './tiles'

export interface HeroInput extends OverviewInput {
  /** NWS period forecast (`fetchNwsForecast`), or undefined while loading / on failure. */
  forecast: NwsForecast | undefined
  /** NWS hourly forecast (`fetchNwsHourly`), or undefined. */
  forecastHourly: readonly HourlyForecastPoint[] | undefined
}

export interface HeroView {
  /** "57°", or null without an air temperature. */
  temp: string | null
  /** "Feels like 49°" and "Wind chill"/"Heat index" (null when it is the air temperature). */
  feels: string | null
  feelsKind: string | null
  /** "High 63° · Low 40°" today, or null before the hourly rows. */
  highLow: string | null
  /** "Normal 67° / 38°", or null without normals. */
  normal: string | null
  /** One sentence ("Clear tonight, light SSE wind, no rain in 5 days."), "" when nothing is known. */
  summary: string
  /** The 48 h strip, or null with neither observed nor forecast hours. */
  strip: HeroStripModel | null
  freshness: Freshness | null
}

const H24 = 24 * 3_600_000
const ICON_HOST = /^https:\/\/api\.weather\.gov\//

/** A period's temperature in °F (NWS sends F for US points; C converts). */
const periodF = (p: ForecastPeriod) => (p.temperatureUnit === 'C' ? (p.temperature * 9) / 5 + 32 : p.temperature)

/** The period covering wall-clock `t`, else the first; null without periods. */
function currentPeriod(periods: readonly ForecastPeriod[], t: number): ForecastPeriod | null {
  const covers = (p: ForecastPeriod) => {
    const [s, e] = [parseWallClock(p.startTime), parseWallClock(p.endTime)]
    return s !== null && e !== null && s <= t && t < e
  }
  return periods.find(covers) ?? periods[0] ?? null
}

/** Periods whose midpoint falls in the next 24 h, labelled "Tonight 45°". */
function stripPeriods(periods: readonly ForecastPeriod[], now: number): StripPeriod[] {
  return periods.flatMap((p) => {
    const [s, e] = [parseWallClock(p.startTime), parseWallClock(p.endTime)]
    if (s === null || e === null || !Number.isFinite(p.temperature)) return []
    const t = (s + e) / 2
    if (t <= now || t > now + H24) return []
    return [{ t, label: `${p.name} ${Math.round(periodF(p))}°`, icon: ICON_HOST.test(p.icon) ? p.icon : null, short: p.shortForecast }]
  })
}

/** Observed hourly air temperature in (now − 24 h, now], plus the `/latest` reading at now. */
function observed(input: HeroInput, now: number, airF: number | null): HeroStripModel['observed'] {
  const pts = new Map<number, number | null>()
  for (const r of input.hourly ?? []) {
    const t = parseWallClock(r.datetime)
    const v = r['Air Temperature [°F]']
    if (t !== null && t > now - H24 && t <= now) pts.set(t, typeof v === 'number' && Number.isFinite(v) ? v : null)
  }
  if (airF !== null) pts.set(now, airF)
  const t = [...pts.keys()].sort((a, b) => a - b)
  return { t, v: t.map((x) => pts.get(x) ?? null) }
}

/** The hero view; all null and "" until `/latest` arrives (no summary or strip without its stamp). */
export function buildHero(input: HeroInput): HeroView {
  const o = buildOverview(input)
  const view: HeroView = {
    temp: o.hero?.temp ?? null,
    feels: o.hero?.feels ?? null,
    feelsKind: o.hero?.feelsKind ?? null,
    highLow: o.hero?.highLow ?? null,
    normal: o.hero?.normal ?? null,
    summary: '',
    strip: null,
    freshness: o.freshness,
  }
  if (!input.latest) return view
  const c = readConditions(input.latest)
  const now = parseWallClock(c.stamp)
  if (now === null) return view

  const periods = input.forecast?.periods ?? []
  const p = precipSummary(input.ppt, input.hourly ? hourlyPrecip(input.hourly, input.today) : null)
  const summary = summarize({
    shortForecast: currentPeriod(periods, now)?.shortForecast ?? null,
    windMph: c.windMph,
    windDeg: c.windDeg,
    rainTodayIn: p.sinceMidnight,
    daysSinceRain: daysSinceRain(p, input.hourly, input.today),
    nowWallMs: now,
  })

  const fc = (input.forecastHourly ?? []).filter((h) => h.t > now && h.t <= now + H24)
  const obs = observed(input, now, c.airF)
  const strip: HeroStripModel | null =
    obs.t.length || fc.length
      ? { observed: obs, forecast: { t: fc.map((h) => h.t), v: fc.map((h) => h.tempF) }, now: { t: now, v: c.airF }, periods: stripPeriods(periods, now) }
      : null

  return { ...view, summary, strip }
}
