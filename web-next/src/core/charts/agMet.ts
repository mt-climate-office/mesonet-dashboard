/**
 * Ag Tools met charts: reference ET (bars + cumulative), feels-like and
 * livestock risk (CCI) (index line + classed markers). Input is the SI
 * contract series; °C → °F and mm → in happen here.
 */
import type { EChartsOption } from 'echarts'
import type { CciClass, CciSeries, EtoSeries, FeelsLikeSeries } from '../ag/contract'
import { CCI_HEAT_ONSET_F, cToF, cciColdOnsetF, cciSide, cumulativeSum, mmToIn } from '../ag/compute'
import { CCI_CLASSES, FEELS_LIKE_LABELS } from '../ag/view/labels'
import { ETR, FEELS_LIKE, INDEX_LINE, type StressSide, cciStyle } from '../palette'
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

type Ys = (number | null)[]

/** Legend icon for a dashed line: three short dashes. */
const DASH_ICON = 'path://M0,4h5v2H0zM7,4h5v2H7zM14,4h5v2h-5z'

/**
 * Thin index line (a drawing aid: no legend, no tooltip) + an optional named comparison line + one
 * marker series per class present, in `order`, + optional dashed reference lines labelled inside
 * the plot.
 */
function indexChart<K extends string>(
  ctx: ChartContext,
  o: {
    xs: number[]
    /** Index values (°F): the line and the marker heights. */
    yF: Ys
    /** A second, named line (legend, tooltip), dashed, e.g. the air temperature. */
    compare?: { name: string; yF: Ys; id: string }
    classOf: (K | null)[]
    order: readonly K[]
    /** Legend and tooltip name (also the series name). */
    label: (k: K) => string
    style: (k: K) => { color: string; symbol?: string }
    period: Period
    yName: string
    legendTitle?: string
    refLines?: { y: number; label: string }[]
    /** Tooltip row for a series name and its y (°F). */
    tip: (name: string, y: number) => string | null
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
  const lg = agLegend(
    ctx,
    [
      ...(o.compare ? [{ name: o.compare.name, icon: DASH_ICON }] : []),
      ...present.map((k) => ({ name: o.label(k), text: sentenceCase(o.label(k)) })),
    ],
    { title: o.legendTitle },
  )
  // A temperature-equivalent index: a free axis (style yBounds), as air temperature.
  const y = { ...valueAxis(o.yName), ...yAxisRange('Air Temperature', ...extentOf([...o.yF, ...(o.compare?.yF ?? [])])) }
  const indexLine = paint(ctx.theme, INDEX_LINE)
  const lineSeriesOpt = lineSeries('Index', line, { color: indexLine, width: REF_WIDTH, id: `${AUX}index-line` })
  const compare = o.compare ? [lineSeries(o.compare.name, points(o.xs, o.compare.yF, step), { color: indexLine, dash: 'dashed', id: o.compare.id })] : []
  if (o.refLines?.length) {
    lineSeriesOpt.markLine = {
      silent: true,
      symbol: 'none',
      lineStyle: { color: indexLine, type: 'dashed', width: 1 },
      label: { position: 'insideStartTop', formatter: '{b}', color: ctx.theme.textMuted, fontFamily: ctx.theme.fontUi, fontSize: 11 },
      data: o.refLines.map((l) => ({ yAxis: l.y, name: l.label })),
    }
  }
  return {
    useUTC: true,
    ...liftForLegend(f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    yAxis: f.trace ? [y, f.trace.yAxis] : y,
    legend: lg.legend,
    graphic: lg.graphic,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, o.period), o.tip),
    series: [...(f.trace ? [f.trace.series] : []), lineSeriesOpt, ...compare, ...markers],
  }
}

/* ------------------------------------------------------------ Feels like */

export interface FeelsLikeModel {
  series: FeelsLikeSeries
  period: Period
}

/** Marker names: where the index differs from the air temperature, and which way. */
export const FEELS_LIKE_MARKERS: Record<'wind_chill' | 'heat_index', string> = {
  wind_chill: 'Wind chill (feels colder)',
  heat_index: 'Heat index (feels hotter)',
}
const MARKED = ['wind_chill', 'heat_index'] as const

/** Series id of the air temperature line (the fidelity harness leaves it out: web/ has none). */
export const AIR_TEMP_ID = 'feels:air-temp'

/** The air temperature line's name: the daily mean for daily rows. */
export const airTempName = (period: Period) => (period === 'daily' ? 'Average temperature' : 'Air temperature')

/**
 * Feels-like °F against the air temperature: the feels-like line, the air temperature dashed, and
 * a marker wherever the two differ: wind chill (colder, blue ◆) or heat index (hotter, red ▲).
 * Elsewhere the lines coincide (the feels-like temperature is the air temperature).
 */
export const feelsLikeChart: ChartBuilder<FeelsLikeModel> = (m, ctx) => {
  const air = airTempName(m.period)
  const kind = new Map<string, string>(MARKED.map((k) => [FEELS_LIKE_MARKERS[k], FEELS_LIKE_LABELS[k]]))
  return indexChart(ctx, {
    xs: m.series.time.map(wallMs),
    yF: m.series.valueC.map((v) => cToF(v)),
    compare: { name: air, yF: m.series.airC.map((v) => cToF(v)), id: AIR_TEMP_ID },
    classOf: m.series.regime.map((r) => (r === 'wind_chill' || r === 'heat_index' ? r : null)),
    order: MARKED,
    label: (k) => FEELS_LIKE_MARKERS[k],
    style: (k) => FEELS_LIKE[ctx.theme.name][k],
    period: m.period,
    yName: axisTitle('feels_like', 'Feels like'),
    tip: (name, y) => {
      const value = `${y.toFixed(1)} °F`
      return name === air ? tipText(air, value) : tipText(`Feels like (${sentenceCase(kind.get(name) ?? name).toLowerCase()})`, value)
    },
  })
}

export function feelsLikeTable(m: FeelsLikeModel): ChartTable {
  return {
    caption: 'Feels-like temperature and air temperature, °F, and the index used',
    columns: [
      m.period === 'hourly' ? 'Time (MT)' : 'Date',
      axisTitle('feels_like', 'Feels like'),
      `${airTempName(m.period)} (°F)`,
      'Index used',
    ],
    rows: m.series.time.map((t, i) => [
      isoWall(wallMs(t), m.period),
      fmtNum(cToF(m.series.valueC[i]), 1),
      fmtNum(cToF(m.series.airC[i]), 1),
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

type CciKey = `${StressSide}:${CciClass}` | 'none'
const STRESS = CCI_CLASSES.slice(1)
/** Legend order, cold to hot: worst cold … mild cold, no stress, mild heat … worst heat. */
const CCI_KEYS: readonly CciKey[] = [
  ...[...STRESS].reverse().map((c) => `cold:${c}` as const),
  'none',
  ...STRESS.map((c) => `heat:${c}` as const),
]

/** A row's class with its side: "Mild (cold)", "Severe (heat)", "No Stress". */
export function cciClassText(cls: CciClass | null, valueF: number | null): string | null {
  if (cls == null) return null
  return cls === 'No Stress' || valueF == null ? cls : `${cls} (${cciSide(valueF)})`
}

const keyOf = (cls: CciClass | null, valueF: number | null): CciKey | null =>
  cls == null || valueF == null ? null : cls === 'No Stress' ? 'none' : `${cciSide(valueF)}:${cls}`

/**
 * Livestock risk index °F: grey line + markers by class, blues for cold stress and reds for heat
 * stress (palette `cciStyle`), and dashed lines where cold and heat stress start for the animal.
 */
export const cciChart: ChartBuilder<CciModel> = (m, ctx) => {
  const yF = m.series.valueC.map((v) => cToF(v))
  const lt = m.series.livestock
  const label = (k: CciKey) => (k === 'none' ? 'No Stress' : `${k.slice(k.indexOf(':') + 1)} (${k.slice(0, k.indexOf(':'))})`)
  return indexChart(ctx, {
    xs: m.series.time.map(wallMs),
    yF,
    classOf: m.series.class.map((c, i) => keyOf(c, yF[i])),
    order: CCI_KEYS,
    label,
    style: (k) => (k === 'none' ? cciStyle('No Stress', 'cold', ctx.theme.name) : cciStyle(k.slice(k.indexOf(':') + 1) as CciClass, k.slice(0, k.indexOf(':')) as StressSide, ctx.theme.name)),
    period: m.period,
    yName: CCI_AXIS,
    legendTitle: cciLegendTitle(lt),
    refLines: [
      { y: CCI_HEAT_ONSET_F, label: `Heat stress from ${CCI_HEAT_ONSET_F} °F` },
      { y: cciColdOnsetF(lt), label: `Cold stress below ${cciColdOnsetF(lt)} °F (${lt})` },
    ],
    tip: (name, y) => tipText(sentenceCase(name), `${y.toFixed(1)} °F`),
  })
}

export function cciTable(m: CciModel): ChartTable {
  return {
    caption: `Comprehensive Climate Index, °F, ${m.series.livestock} livestock risk class`,
    columns: [m.period === 'hourly' ? 'Time (MT)' : 'Date', CCI_AXIS, 'Risk class'],
    rows: m.series.time.map((t, i) => {
      const f = cToF(m.series.valueC[i])
      return [isoWall(wallMs(t), m.period), fmtNum(f, 1), cciClassText(m.series.class[i], f) ?? '—']
    }),
  }
}
