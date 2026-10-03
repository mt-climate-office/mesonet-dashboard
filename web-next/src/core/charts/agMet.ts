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
import { dualAxis, valueAxis } from './axes'
import { fmtNum, fmtWall, isoWall, wallMs, type Period } from './format'
import { AUX, barSeries, lineSeries, markerSeries } from './series'
import { LEGEND_PX, REF_WIDTH, extentOf, plotExtent, points, stepMs, timeFrame, yAxisRange } from './style'
import { paint } from './theme'
import { agLegend, liftForLegend, sentenceCase } from './agLegend'
import { axisTooltip, tipText } from './tooltip'
import type { ChartBuilder, ChartContext, ChartTable } from './types'
import { axisTitle, cumulativeTitle, plainName } from '../variables/labels'

/* ------------------------------------------------------------------ ETr */

export interface EtrModel {
  series: EtoSeries
  period: Period
}

export const ETR_AXIS = axisTitle('etr', 'Reference ET')
export const ETR_CUM_AXIS = cumulativeTitle(ETR_AXIS)
/** The CCI is a temperature-equivalent index, so its axis carries °F. */
const CCI_AXIS = `${axisTitle('cci', 'Livestock risk')} (°F)`

function etrValues(m: EtrModel) {
  const xs = m.series.time.map(wallMs)
  const inches = m.series.etoMm.map((v) => mmToIn(v))
  return { xs, inches, cumulative: cumulativeSum(inches) }
}

/** Daily/hourly reference ET in inches (bars, y1) + cumulative inches (line, y2); the slider traces the cumulative. */
export const etrChart: ChartBuilder<EtrModel> = (m, ctx) => {
  const { xs, inches, cumulative } = etrValues(m)
  const c = ETR[ctx.theme.name]
  const step = stepMs(m.period)
  const name = plainName('etr', 'Reference ET')
  const lg = agLegend(ctx, [
    { name: 'ETr', text: name },
    { name: 'Cumulative ETr', text: cumulativeTitle(name), short: 'Cumulative' },
  ])
  const cum = points(xs, cumulative, step)
  const f = timeFrame(ctx, { extent: plotExtent(xs, step, true), trace: cum, yAxisIndex: 2, legendPx: LEGEND_PX, right: 64 })
  return {
    useUTC: true,
    ...liftForLegend(f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    yAxis: [...dualAxis(ETR_AXIS, ETR_CUM_AXIS), ...(f.trace ? [f.trace.yAxis] : [])],
    legend: lg.legend,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, m.period), (name, y) =>
      tipText(name === 'ETr' ? 'Reference ET' : 'Cumulative', `${y.toFixed(3)} in`),
    ),
    series: [
      ...(f.trace ? [f.trace.series] : []),
      barSeries('ETr', points(xs, inches, step), c.bar),
      lineSeries('Cumulative ETr', cum, { color: c.cumulative, yAxisIndex: 1 }),
    ],
  } satisfies EChartsOption
}

export function etrTable(m: EtrModel): ChartTable {
  const { xs, inches, cumulative } = etrValues(m)
  return {
    caption: 'Reference ET (a=0.23), inches',
    columns: [m.period === 'hourly' ? 'Time (MT)' : 'Date', ETR_AXIS, ETR_CUM_AXIS],
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
    /** Legend and tooltip name (sentence case); `short` on compact screens. */
    label: (k: K) => string
    short?: (k: K) => string
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
  const present = o.order.filter((k) => markers.some((s) => s.name === o.label(k)))
  const step = stepMs(o.period)
  const line = points(o.xs, o.yF, step)
  const f = timeFrame(ctx, { extent: plotExtent(o.xs, step, false), trace: line, yAxisIndex: 1, legendPx: LEGEND_PX })
  const textOf = new Map(present.map((k) => [o.label(k), sentenceCase(o.label(k))]))
  const lg = agLegend(
    ctx,
    present.map((k) => ({ name: o.label(k), text: textOf.get(o.label(k)), short: o.short?.(k) })),
    { title: o.legendTitle },
  )
  // A temperature-equivalent index: a free axis (style yBounds), as air temperature.
  const y = { ...valueAxis(o.yName), ...yAxisRange('Air Temperature', ...extentOf(o.yF)) }
  return {
    useUTC: true,
    ...liftForLegend(f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    yAxis: f.trace ? [y, f.trace.yAxis] : y,
    legend: lg.legend,
    graphic: lg.graphic,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, o.period), (name, y) => tipText(textOf.get(name) ?? name, `${y.toFixed(1)} °F`)),
    series: [
      ...(f.trace ? [f.trace.series] : []),
      lineSeries('Index', line, { color: paint(ctx.theme, INDEX_LINE), width: REF_WIDTH, id: `${AUX}index-line` }),
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
    short: (k) => (k === 'air_temp' ? plainName('air_temp', 'Air temperature') : sentenceCase(FEELS_LIKE_LABELS[k])),
    style: (k) => FEELS_LIKE[ctx.theme.name][k],
    period: m.period,
    yName: axisTitle('feels_like', 'Feels like'),
    legendTitle: 'Index used',
  })

export function feelsLikeTable(m: FeelsLikeModel): ChartTable {
  return {
    caption: 'Feels-like temperature, °F, and the index used',
    columns: [m.period === 'hourly' ? 'Time (MT)' : 'Date', axisTitle('feels_like', 'Feels like'), 'Index used'],
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
  `${plainName('cci', 'Livestock risk')} (${livestock === 'newborn' ? 'newborn' : 'adult'})`

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
    yName: CCI_AXIS,
    legendTitle: cciLegendTitle(m.series.livestock),
  })

export function cciTable(m: CciModel): ChartTable {
  return {
    caption: `Comprehensive Climate Index, °F, ${m.series.livestock} livestock risk class`,
    columns: [m.period === 'hourly' ? 'Time (MT)' : 'Date', CCI_AXIS, 'Risk class'],
    rows: m.series.time.map((t, i) => [
      isoWall(wallMs(t), m.period),
      fmtNum(cToF(m.series.valueC[i]), 1),
      m.series.class[i] ?? '—',
    ]),
  }
}
