/**
 * The Now hero's 48 h strip: the last 24 h of observed hourly air
 * temperature (solid line, light area fill) running into the next 24 h of
 * NWS hourly forecast (dashed), a "now" rule and dot, and the observed high
 * (above its point) and low (below), kept inside the grid by padding the y
 * range. The forecast periods are the icon row under the chart, not labels in
 * it. No zoom (style: the slider adds nothing to 48 h); the now dot is its one
 * last-point marker; tooltip on hover or tap. Model from core/overview/hero.ts; °F,
 * Denver wall-clock ms.
 */
import type { EChartsOption, ScatterSeriesOption } from 'echarts'
import { HERO_STRIP, variableStyle, withAlpha } from '../palette'
import { fmtNum, fmtWall, isoWall, MISSING } from './format'
import { AUX, lineSeries } from './series'
import { points, stepMs } from './style'
import { paint } from './theme'
import { axisTooltip, tipText } from './tooltip'
import type { ChartBuilder, ChartContext, ChartTable } from './types'

/** A forecast period in the strip's next 24 h (the icon row and the table caption). */
export interface StripPeriod {
  /** The period's midpoint, wall-clock ms. */
  t: number
  /** "Tonight 45°". */
  label: string
  /** NWS icon URL (api.weather.gov only) for the icon row, or null. */
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

const H = 3_600_000

/** "Now", "Noon", else "6 AM" / "3 PM": a strip tick label (wall-clock ms, read as UTC). */
export function stripTickLabel(t: number, now: number): string {
  if (t === now) return 'Now'
  const h = new Date(t).getUTCHours()
  if (h === 0) return '12 AM'
  if (h === 12) return 'Noon'
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * The strip's x ticks: `now` plus every `stepH`-th wall-clock hour in [min, max],
 * dropping hours closer to `now` than half a step so no two labels touch.
 */
export function stripTicks(min: number, max: number, now: number, stepH: number): number[] {
  const step = stepH * H
  const out = [now]
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) if (Math.abs(t - now) >= step / 2) out.push(t)
  return out.sort((a, b) => a - b)
}

/** y range padded so the High/Low labels fit inside the grid: 30% of the span (≥ 4°) each side. */
function yRange(m: HeroStripModel): { min: number; max: number } | null {
  const vs = [...m.observed.v, ...m.forecast.v, m.now.v].filter((v): v is number => v !== null)
  if (!vs.length) return null
  const [lo, hi] = [Math.min(...vs), Math.max(...vs)]
  const pad = Math.max(4, (hi - lo) * 0.3)
  return { min: Math.floor(lo - pad), max: Math.ceil(hi + pad) }
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

/**
 * A labelled-point drawing aid (no tooltip, no legend). A label near either
 * end of the x span is aligned inward so it never runs past the grid.
 */
function labels(id: string, ctx: ChartContext, color: string, span: [number, number], pts: { x: number; y: number; text: string; below?: boolean }[]): ScatterSeriesOption {
  const edge = (span[1] - span[0]) * 0.1
  const align = (x: number) => (x < span[0] + edge ? 'left' : x > span[1] - edge ? 'right' : 'center')
  return {
    type: 'scatter',
    id: `${AUX}${id}`,
    silent: true,
    symbolSize: 5,
    itemStyle: { color },
    data: pts.map((p) => ({
      value: [p.x, p.y],
      label: { show: true, formatter: p.text, position: p.below ? 'bottom' : 'top', align: align(p.x), color: ctx.theme.textMuted, fontFamily: ctx.theme.fontUi, fontSize: ctx.compact ? 10 : 11 },
    })),
  }
}

/** Observed (solid + area) → forecast (dashed), now rule + dot, high/low labels. */
export const heroStripChart: ChartBuilder<HeroStripModel> = (m, ctx) => {
  const color = variableStyle('Air Temperature', ctx.theme.name)!.color
  const rule = paint(ctx.theme, HERO_STRIP.nowRule)
  const observed = lineSeries('Observed', points(m.observed.t, m.observed.v, stepMs('hourly')), { color })
  // The forecast starts at the now point so the two lines meet.
  const fcX = m.now.v === null ? m.forecast.t : [m.now.t, ...m.forecast.t]
  const fcY = m.now.v === null ? m.forecast.v : [m.now.v, ...m.forecast.v]
  const ext = extremes(m)
  const span: [number, number] = [m.now.t - H24, m.now.t + H24]
  // Ticks every 6 h on phones ("Now", "6 PM", "12 AM", …), every 3 h wider.
  const ticks = stripTicks(span[0], span[1], m.now.t, ctx.compact ? 6 : 3)
  const y = yRange(m)
  return {
    useUTC: true,
    grid: { left: ctx.compact ? 32 : 40, right: 12, top: 8, bottom: 24 },
    xAxis: {
      type: 'time',
      min: span[0],
      max: span[1],
      splitLine: { show: false },
      axisTick: { customValues: ticks },
      axisLabel: { hideOverlap: true, customValues: ticks, formatter: (t: number) => stripTickLabel(t, m.now.t) },
    },
    yAxis: {
      type: 'value',
      min: y?.min,
      max: y?.max,
      scale: true,
      splitNumber: 3,
      // The padded ends are not round numbers: label only the inner ticks.
      axisLabel: { formatter: '{value}°', showMinLabel: false, showMaxLabel: false },
    },
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, 'hourly'), (name, y) => tipText(name, `${Math.round(y)} °F`)),
    series: [
      { ...observed, areaStyle: { color: withAlpha(color, HERO_STRIP.areaAlpha), origin: 'start' } },
      lineSeries('Forecast', points(fcX, fcY, stepMs('hourly')), { color, dash: 'dashed' }),
      {
        type: 'scatter',
        id: `${AUX}now`,
        silent: true,
        symbolSize: 9,
        itemStyle: { color },
        data: m.now.v === null ? [] : [[m.now.t, m.now.v]],
        markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: rule, type: 'solid', width: 1 }, data: [{ xAxis: m.now.t }] },
      },
      labels('extremes', ctx, color, span, ext ? [
        { x: ext.hi[0], y: ext.hi[1], text: `High ${deg(ext.hi[1])}` },
        { x: ext.lo[0], y: ext.lo[1], text: `Low ${deg(ext.lo[1])}`, below: true },
      ] : []),
    ],
  } satisfies EChartsOption
}

/** The sr-only twin: one row per hour, observed then forecast; period labels in the caption. */
export function heroStripTable(m: HeroStripModel): ChartTable {
  const periods = m.periods.map((p) => p.label).join(', ')
  return {
    caption: `Air temperature, °F: the last 24 hours observed and the next 24 hours of NWS forecast${periods ? `. Forecast periods: ${periods}` : ''}.`,
    columns: ['Time (MT)', 'Observed (°F)', 'Forecast (°F)'],
    rows: [
      ...m.observed.t.map((t, i) => [isoWall(t, 'hourly'), fmtNum(m.observed.v[i], 0), MISSING]),
      ...m.forecast.t.map((t, i) => [isoWall(t, 'hourly'), MISSING, fmtNum(m.forecast.v[i], 0)]),
    ],
  }
}
