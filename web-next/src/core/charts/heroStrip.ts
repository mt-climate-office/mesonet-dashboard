/**
 * The Now hero's 48 h strip: the last 24 h of observed hourly air
 * temperature (solid line, light area fill) running into the next 24 h of
 * NWS hourly forecast (dashed), a "now" rule and dot, the observed high and
 * low, and small forecast-period labels ("Tonight 45°"). No zoom; tooltip on
 * hover or tap. Model from core/overview/hero.ts; °F, Denver wall-clock ms.
 */
import type { EChartsOption, ScatterSeriesOption } from 'echarts'
import { HERO_STRIP, variableStyle, withAlpha } from '../palette'
import { timeAxis } from './axes'
import { fmtNum, fmtWall, isoWall, MISSING } from './format'
import { AUX, lineSeries, points } from './series'
import { paint } from './theme'
import { axisTooltip, tipText } from './tooltip'
import type { ChartBuilder, ChartContext, ChartTable } from './types'

/** A forecast period's label on the strip. */
export interface StripPeriod {
  /** Where the label sits: the period's midpoint, wall-clock ms. */
  t: number
  /** "Tonight 45°". */
  label: string
  /** NWS icon URL (api.weather.gov only) for the UI to draw beside the label, or null. */
  icon: string | null
  /** The period's short forecast (icon alt text). */
  short: string
}

export interface HeroStripModel {
  /** Observed hourly air temperature, ascending, ending at `now` (°F, nulls are gaps). */
  observed: { t: number[]; v: (number | null)[] }
  /** NWS hourly forecast after `now` (°F). */
  forecast: { t: number[]; v: number[] }
  /** The newest observation: where the rule and dot sit. */
  now: { t: number; v: number | null }
  periods: StripPeriod[]
}

const H24 = 24 * 3_600_000
const deg = (v: number) => `${Math.round(v)}°`

/** Forecast value at `t`: the nearest forecast hour (or `now` before the first). */
function forecastAt(m: HeroStripModel, t: number): number | null {
  let best: [number, number | null] = [Math.abs(t - m.now.t), m.now.v]
  m.forecast.t.forEach((x, i) => {
    if (Math.abs(t - x) < best[0]) best = [Math.abs(t - x), m.forecast.v[i]]
  })
  return best[1]
}

/** Observed high and low (first occurrence of each), or null with no data. */
function extremes(m: HeroStripModel): { hi: [number, number]; lo: [number, number] } | null {
  let out: { hi: [number, number]; lo: [number, number] } | null = null
  for (let i = 0; i < m.observed.v.length; i++) {
    const v = m.observed.v[i]
    if (v === null) continue
    const p: [number, number] = [m.observed.t[i], v]
    if (!out) out = { hi: p, lo: p }
    else if (v > out.hi[1]) out.hi = p
    else if (v < out.lo[1]) out.lo = p
  }
  return out
}

/** A labelled-point drawing aid (no tooltip, no legend). */
function labels(id: string, ctx: ChartContext, color: string, pts: { x: number; y: number; text: string; below?: boolean }[]): ScatterSeriesOption {
  return {
    type: 'scatter',
    id: `${AUX}${id}`,
    silent: true,
    symbolSize: 5,
    itemStyle: { color },
    data: pts.map((p) => ({
      value: [p.x, p.y],
      label: { show: true, formatter: p.text, position: p.below ? 'bottom' : 'top', color: ctx.theme.textMuted, fontFamily: ctx.theme.fontUi, fontSize: ctx.compact ? 10 : 11 },
    })),
  }
}

/** Observed (solid + area) → forecast (dashed), now rule + dot, high/low and period labels. */
export const heroStripChart: ChartBuilder<HeroStripModel> = (m, ctx) => {
  const color = variableStyle('Air Temperature', ctx.theme.name)!.color
  const rule = paint(ctx.theme, HERO_STRIP.nowRule)
  const observed = lineSeries('Observed', points(m.observed.t, m.observed.v), { color })
  // The forecast starts at the now point so the two lines meet.
  const fcX = m.now.v === null ? m.forecast.t : [m.now.t, ...m.forecast.t]
  const fcY = m.now.v === null ? m.forecast.v : [m.now.v, ...m.forecast.v]
  const ext = extremes(m)
  const periodPts = m.periods.flatMap((p) => {
    const y = forecastAt(m, p.t)
    return y === null ? [] : [{ x: p.t, y, text: p.label }]
  })
  return {
    useUTC: true,
    grid: { left: ctx.compact ? 32 : 40, right: 12, top: 28, bottom: 24 },
    xAxis: timeAxis({ min: m.now.t - H24, max: m.now.t + H24 }),
    yAxis: { type: 'value', scale: true, splitNumber: 3, axisLabel: { formatter: '{value}°' } },
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, 'hourly'), (name, y) => tipText(name, `${Math.round(y)} °F`)),
    series: [
      { ...observed, areaStyle: { color: withAlpha(color, HERO_STRIP.areaAlpha), origin: 'start' } },
      lineSeries('Forecast', points(fcX, fcY), { color, dash: 'dashed' }),
      {
        type: 'scatter',
        id: `${AUX}now`,
        silent: true,
        symbolSize: 9,
        itemStyle: { color },
        data: m.now.v === null ? [] : [[m.now.t, m.now.v]],
        markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: rule, type: 'solid', width: 1 }, data: [{ xAxis: m.now.t }] },
      },
      labels('extremes', ctx, color, ext ? [
        { x: ext.hi[0], y: ext.hi[1], text: `High ${deg(ext.hi[1])}` },
        { x: ext.lo[0], y: ext.lo[1], text: `Low ${deg(ext.lo[1])}`, below: true },
      ] : []),
      labels('periods', ctx, rule, periodPts),
    ],
  } satisfies EChartsOption
}

/** The sr-only twin: one row per hour, observed then forecast; period labels in the caption. */
export function heroStripTable(m: HeroStripModel): ChartTable {
  const periods = m.periods.map((p) => p.label).join(', ')
  return {
    caption: `Air temperature, °F: the last 24 hours observed and the next 24 hours of NWS forecast${periods ? `. Forecast periods: ${periods}` : ''}.`,
    columns: ['Time (MT)', 'Observed [°F]', 'Forecast [°F]'],
    rows: [
      ...m.observed.t.map((t, i) => [isoWall(t, 'hourly'), fmtNum(m.observed.v[i], 0), MISSING]),
      ...m.forecast.t.map((t, i) => [isoWall(t, 'hourly'), MISSING, fmtNum(m.forecast.v[i], 0)]),
    ],
  }
}
