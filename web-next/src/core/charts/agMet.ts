/**
 * Ag Tools met charts: reference ET (bars + cumulative), feels-like and
 * livestock risk (CCI) (index line + classed markers). Input is the SI
 * contract series; °C → °F and mm → in happen here.
 */
import type { EChartsOption } from 'echarts'
import type { CciSeries, EtoSeries, FeelsLikeRegime, FeelsLikeSeries } from '../ag/contract'
import { cToF, cumulativeSum, mmToIn } from '../ag/compute'
import { CCI_CLASSES, FEELS_LIKE_LABELS } from '../ag/view/labels'
import { ETR, FEELS_LIKE, INDEX_LINE, cciColor } from '../palette'
import { dualAxis, grid, timeAxis, timeZoom, valueAxis } from './axes'
import { fmtNum, fmtWall, isoWall, wallMs, type Period } from './format'
import { AUX, barSeries, lineSeries, markerSeries, points } from './series'
import { paint } from './theme'
import { axisTooltip, legend, tipText } from './tooltip'
import type { ChartBuilder, ChartContext, ChartTable } from './types'

/* ------------------------------------------------------------------ ETr */

export interface EtrModel {
  series: EtoSeries
  period: Period
}

export const ETR_AXIS = 'Reference ET\n(a=0.23) [in]'
export const ETR_CUM_AXIS = 'Cumulative Reference ET\n(a=0.23) [in]'

function etrValues(m: EtrModel) {
  const xs = m.series.time.map(wallMs)
  const inches = m.series.etoMm.map((v) => mmToIn(v))
  return { xs, inches, cumulative: cumulativeSum(inches) }
}

/** Daily/hourly reference ET in inches (bars, y1) + cumulative inches (line, y2). */
export const etrChart: ChartBuilder<EtrModel> = (m, ctx) => {
  const { xs, inches, cumulative } = etrValues(m)
  const c = ETR[ctx.theme.name]
  const lg = legend(ctx)
  return {
    useUTC: true,
    grid: grid(ctx, { right: 64 }),
    xAxis: timeAxis(),
    yAxis: dualAxis(ETR_AXIS, ETR_CUM_AXIS),
    dataZoom: timeZoom(ctx),
    legend: lg.legend,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, m.period), (name, y) =>
      tipText(name === 'ETr' ? 'Reference ET' : 'Cumulative', `${y.toFixed(3)} in`),
    ),
    series: [
      barSeries('ETr', points(xs, inches), c.bar),
      lineSeries('Cumulative ETr', points(xs, cumulative), { color: c.cumulative, yAxisIndex: 1 }),
    ],
  } satisfies EChartsOption
}

export function etrTable(m: EtrModel): ChartTable {
  const { xs, inches, cumulative } = etrValues(m)
  return {
    caption: 'Reference ET (a=0.23), inches',
    columns: [m.period === 'hourly' ? 'Time (MT)' : 'Date', 'Reference ET [in]', 'Cumulative [in]'],
    rows: xs.map((x, i) => [isoWall(x, m.period), fmtNum(inches[i], 3), fmtNum(cumulative[i], 3)]),
  }
}

/* ------------------------------------------------- index line + markers */

/** Thin index line (no tooltip) + one marker series per class present, in `order`. */
function indexChart<K extends string>(
  ctx: ChartContext,
  o: {
    xs: number[]
    yF: (number | null)[]
    classOf: (K | null)[]
    order: readonly K[]
    label: (k: K) => string
    style: (k: K) => { color: string; symbol?: string }
    period: Period
    yName: string
    legendTitle: string
  },
): EChartsOption {
  const size = o.period === 'hourly' ? 5 : 8
  const markers = o.order.flatMap((k) => {
    const ix = o.classOf.flatMap((c, i) => (c === k && o.yF[i] != null ? [i] : []))
    if (ix.length === 0) return []
    return [markerSeries(o.label(k), ix.map((i) => [o.xs[i], o.yF[i]] as [number, number]), { ...o.style(k), size })]
  })
  const lg = legend(ctx, { title: o.legendTitle, data: markers.map((s) => String(s.name)) })
  return {
    useUTC: true,
    grid: grid(ctx),
    xAxis: timeAxis(),
    yAxis: valueAxis(o.yName),
    dataZoom: timeZoom(ctx),
    legend: lg.legend,
    graphic: lg.graphic,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, o.period), (name, y) => tipText(name, `${y.toFixed(1)} °F`)),
    series: [
      lineSeries('Index', points(o.xs, o.yF), { color: paint(ctx.theme, INDEX_LINE), width: 1, id: `${AUX}index-line` }),
      ...markers,
    ],
  }
}

/* ------------------------------------------------------------ Feels like */

export interface FeelsLikeModel {
  series: FeelsLikeSeries
  period: Period
}

const REGIMES = Object.keys(FEELS_LIKE_LABELS) as FeelsLikeRegime[]

/** Feels-like °F: grey line + markers by regime (wind chill ◆, heat index ▲, air temperature ●). */
export const feelsLikeChart: ChartBuilder<FeelsLikeModel> = (m, ctx) =>
  indexChart(ctx, {
    xs: m.series.time.map(wallMs),
    yF: m.series.valueC.map((v) => cToF(v)),
    classOf: m.series.regime,
    order: REGIMES,
    label: (k) => FEELS_LIKE_LABELS[k],
    style: (k) => FEELS_LIKE[ctx.theme.name][k],
    period: m.period,
    yName: 'Feels Like Temperature\n[°F]',
    legendTitle: 'Index Used',
  })

export function feelsLikeTable(m: FeelsLikeModel): ChartTable {
  return {
    caption: 'Feels-like temperature, °F, and the index used',
    columns: [m.period === 'hourly' ? 'Time (MT)' : 'Date', 'Feels like [°F]', 'Index used'],
    rows: m.series.time.map((t, i) => [
      isoWall(wallMs(t), m.period),
      fmtNum(cToF(m.series.valueC[i]), 1),
      m.series.regime[i] ? FEELS_LIKE_LABELS[m.series.regime[i]!] : '—',
    ]),
  }
}

/* ------------------------------------------------------------------ CCI */

export interface CciModel {
  series: CciSeries
  period: Period
}

export const cciLegendTitle = (livestock: CciSeries['livestock']) =>
  livestock === 'newborn' ? 'Livestock Risk (newborn)' : 'Livestock Risk (adult)'

/** Livestock risk index °F: grey line + markers by class in severity order. */
export const cciChart: ChartBuilder<CciModel> = (m, ctx) =>
  indexChart(ctx, {
    xs: m.series.time.map(wallMs),
    yF: m.series.valueC.map((v) => cToF(v)),
    classOf: m.series.class,
    order: CCI_CLASSES,
    label: (k) => k,
    style: (k) => ({ color: cciColor(k, ctx.theme.name) }),
    period: m.period,
    yName: 'Livestock Risk Index [°F]',
    legendTitle: cciLegendTitle(m.series.livestock),
  })

export function cciTable(m: CciModel): ChartTable {
  return {
    caption: `Comprehensive Climate Index, °F, ${m.series.livestock} livestock risk class`,
    columns: [m.period === 'hourly' ? 'Time (MT)' : 'Date', 'CCI [°F]', 'Risk class'],
    rows: m.series.time.map((t, i) => [
      isoWall(wallMs(t), m.period),
      fmtNum(cToF(m.series.valueC[i]), 1),
      m.series.class[i] ?? '—',
    ]),
  }
}
