/**
 * Ag Tools met charts: reference ET (bars + cumulative), feels-like and
 * livestock risk (CCI): hourly as an index line + classed markers, daily as
 * each day's low–high range + markers at the stressed ends. Input is the SI
 * contract series; °C → °F and mm → in happen here.
 */
import type { EChartsOption } from 'echarts'
import type { CciClass, CciRangeSeries, CciSeries, EtoSeries, FeelsLikeRangeSeries, FeelsLikeSeries } from '../ag/contract'
import { CCI_HEAT_ONSET_F, cToF, cciColdOnsetF, cciSide, cumulativeSum, mmToIn } from '../ag/compute'
import { CCI_CLASSES, FEELS_LIKE_LABELS } from '../ag/view/labels'
import { DAILY_RANGE, ETR, FEELS_LIKE, INDEX_LINE, type StressSide, cciStyle } from '../palette'
import { dualAxis, valueAxis } from './axes'
import { fmtNum, fmtWall, isoWall, wallMs, type Period } from './format'
import { AUX, barSeries, lineSeries, markerSeries } from './series'
import { DAY, LEGEND_PX, REF_WIDTH, extentOf, plotExtent, points, stepMs, timeFrame, yAxisRange } from './style'
import { bandSeries } from './overlays'
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
  if (o.refLines?.length) lineSeriesOpt.markLine = refMarkLine(ctx, o.refLines)
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

/**
 * Daily range chart: each day's low–high as a band, and a marker at an end where it is stressed
 * (one series per class, both ends together; each point notes "Daily high" / "Daily low").
 */
function rangeChart<K extends string>(
  ctx: ChartContext,
  o: {
    dates: readonly string[]
    band: { name: string; lo: Ys; hi: Ys }
    /** The ends to mark (°F), each with its class per day (null: no marker) and its tooltip note. */
    ends: { yF: Ys; classOf: (K | null)[]; note: string }[]
    order: readonly K[]
    label: (k: K) => string
    style: (k: K) => { color: string; symbol?: string }
    yName: string
    legendTitle?: string
    refLines?: { y: number; label: string }[]
    tip: (name: string, y: number, note: string | undefined) => string | null
  },
): EChartsOption {
  const xs = o.dates.map(wallMs)
  const markers = o.order.flatMap((k) => {
    const pts = o.ends.flatMap((e) =>
      e.classOf.flatMap((c, i) => (c === k && e.yF[i] != null ? [[xs[i], e.yF[i], e.note] as [number, number, string]] : [])),
    )
    return pts.length ? [markerSeries(o.label(k), pts.sort((a, b) => a[0] - b[0]), { ...o.style(k), size: 8 })] : []
  })
  const present = o.order.filter((k) => markers.some((s) => s.name === o.label(k)))
  const hi = points(xs, o.band.hi, DAY)
  const f = timeFrame(ctx, { extent: plotExtent(xs, DAY, false), trace: hi, yAxisIndex: 1, legendPx: LEGEND_PX })
  const lg = agLegend(
    ctx,
    [{ name: o.band.name, icon: 'rect' }, ...present.map((k) => ({ name: o.label(k), text: sentenceCase(o.label(k)) }))],
    { title: o.legendTitle },
  )
  const all = [...o.band.lo, ...o.band.hi, ...o.ends.flatMap((e) => e.yF)]
  const y = { ...valueAxis(o.yName), ...yAxisRange('Air Temperature', ...extentOf(all)) }
  // The band is a fill, not a mark (palette DAILY_RANGE): the markers, tooltip and table carry the values.
  const [base, fill] = bandSeries(o.band.name, 'Daily low', xs, o.band.lo, o.band.hi, {
    color: paint(ctx.theme, { ...INDEX_LINE, alpha: DAILY_RANGE.alpha }),
    stack: 'range',
    step: DAY,
  })
  if (o.refLines?.length) base.markLine = refMarkLine(ctx, o.refLines)
  return {
    useUTC: true,
    ...liftForLegend(f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    yAxis: f.trace ? [y, f.trace.yAxis] : y,
    legend: lg.legend,
    graphic: lg.graphic,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, 'daily'), o.tip),
    series: [...(f.trace ? [f.trace.series] : []), base, fill, ...markers],
  }
}

/** Dashed reference lines labelled inside the plot at their left end. */
function refMarkLine(ctx: ChartContext, lines: { y: number; label: string }[]) {
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: paint(ctx.theme, INDEX_LINE), type: 'dashed' as const, width: 1 },
    label: { position: 'insideStartTop' as const, formatter: '{b}', color: ctx.theme.textMuted, fontFamily: ctx.theme.fontUi, fontSize: 11 },
    data: lines.map((l) => ({ yAxis: l.y, name: l.label })),
  }
}

/* ------------------------------------------------------------ Feels like */

/** Hourly: the hourly series. Daily: each day's high and low hour (core/ag/compute/dailyRange). */
export type FeelsLikeModel = { series: FeelsLikeSeries; period: Period } | { range: FeelsLikeRangeSeries; period: 'daily' }

/**
 * Marker names: where an index replaces the air temperature. Not "feels hotter": in dry air the
 * heat index can sit below the air temperature (the NWS low-humidity adjustment).
 */
export const FEELS_LIKE_MARKERS: Record<'wind_chill' | 'heat_index', string> = {
  wind_chill: 'Wind chill',
  heat_index: 'Heat index',
}
const MARKED = ['wind_chill', 'heat_index'] as const

/** Series id of the air temperature line (the fidelity harness leaves it out: web/ has none). */
export const AIR_TEMP_ID = 'feels:air-temp'

/** The air temperature line's name: the daily mean for daily rows. */
export const airTempName = (period: Period) => (period === 'daily' ? 'Average temperature' : 'Air temperature')

/** The daily chart's band: the day's air temperature range. */
export const AIR_RANGE_NAME = 'Air temperature (daily low–high)'
const END_NOTE = { high: 'Daily high', low: 'Daily low' } as const

/**
 * Feels-like °F against the air temperature: the feels-like line, the air temperature dashed, and
 * a marker wherever an index applies: wind chill (blue ◆) or heat index (red ▲). Elsewhere the
 * lines coincide (the feels-like temperature is the air temperature).
 */
export const feelsLikeChart: ChartBuilder<FeelsLikeModel> = (m, ctx) => {
  const kind = new Map<string, string>(MARKED.map((k) => [FEELS_LIKE_MARKERS[k], FEELS_LIKE_LABELS[k]]))
  const feels = (name: string) => `Feels like (${sentenceCase(kind.get(name) ?? name).toLowerCase()})`
  if ('range' in m) return feelsLikeRangeChart(m.range, ctx, feels)
  const air = airTempName(m.period)
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
      return name === air ? tipText(air, value) : tipText(feels(name), value)
    },
  })
}

/**
 * Daily feels like: the day's air temperature range as a band; a heat index at the day's high
 * (red ▲) and a wind chill at its low (blue ◆) show what it felt like against that range.
 */
function feelsLikeRangeChart(r: FeelsLikeRangeSeries, ctx: ChartContext, feels: (name: string) => string): EChartsOption {
  const f = (xs: readonly (number | null)[]) => xs.map((v) => cToF(v))
  return rangeChart(ctx, {
    dates: r.date,
    band: { name: AIR_RANGE_NAME, lo: f(r.airLowC), hi: f(r.airHighC) },
    ends: [
      { yF: f(r.highC), classOf: r.highRegime.map((g) => (g === 'heat_index' ? g : null)), note: END_NOTE.high },
      { yF: f(r.lowC), classOf: r.lowRegime.map((g) => (g === 'wind_chill' ? g : null)), note: END_NOTE.low },
    ],
    order: MARKED,
    label: (k) => FEELS_LIKE_MARKERS[k],
    style: (k) => FEELS_LIKE[ctx.theme.name][k],
    yName: axisTitle('feels_like', 'Feels like'),
    tip: (name, y, note) => {
      if (name === AIR_RANGE_NAME) return note ? tipText('Air temperature', `${note} °F`) : null
      return tipText(`${feels(name)}, ${(note ?? '').toLowerCase()}`, `${y.toFixed(1)} °F`)
    },
  })
}

export function feelsLikeTable(m: FeelsLikeModel): ChartTable {
  if ('range' in m) {
    const r = m.range
    const regime = (g: FeelsLikeRangeSeries['highRegime'][number]) => (g ? FEELS_LIKE_LABELS[g] : '—')
    return {
      caption: 'Daily feels-like high and low (the day’s highest and lowest hourly value), °F, the index used, and the air temperature range',
      columns: ['Date', 'Feels like high (°F)', 'Index at high', 'Feels like low (°F)', 'Index at low', 'Air temperature high (°F)', 'Air temperature low (°F)'],
      rows: r.date.map((d, i) => [
        d,
        fmtNum(cToF(r.highC[i]), 1),
        regime(r.highRegime[i]),
        fmtNum(cToF(r.lowC[i]), 1),
        regime(r.lowRegime[i]),
        fmtNum(cToF(r.airHighC[i]), 1),
        fmtNum(cToF(r.airLowC[i]), 1),
      ]),
    }
  }
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

/** Hourly: the hourly series. Daily: each day's high and low hour (core/ag/compute/dailyRange). */
export type CciModel = { series: CciSeries; period: Period } | { range: CciRangeSeries; period: 'daily' }

/** The daily chart's band: the day's index range. */
export const CCI_RANGE_NAME = 'Daily low–high'

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
  const lt = 'range' in m ? m.range.livestock : m.series.livestock
  const label = (k: CciKey) => (k === 'none' ? 'No Stress' : `${k.slice(k.indexOf(':') + 1)} (${k.slice(0, k.indexOf(':'))})`)
  const style = (k: CciKey) =>
    k === 'none'
      ? cciStyle('No Stress', 'cold', ctx.theme.name)
      : cciStyle(k.slice(k.indexOf(':') + 1) as CciClass, k.slice(0, k.indexOf(':')) as StressSide, ctx.theme.name)
  const refLines = [
    { y: CCI_HEAT_ONSET_F, label: `Heat stress from ${CCI_HEAT_ONSET_F} °F` },
    { y: cciColdOnsetF(lt), label: `Cold stress below ${cciColdOnsetF(lt)} °F (${lt})` },
  ]
  if ('range' in m) {
    // Daily: the band is the day's range; only a stressed end gets a marker.
    const r = m.range
    const hi = r.highC.map((v) => cToF(v))
    const lo = r.lowC.map((v) => cToF(v))
    const stressed = (cls: CciClass | null, f: number | null) => (cls === 'No Stress' ? null : keyOf(cls, f))
    return rangeChart(ctx, {
      dates: r.date,
      band: { name: CCI_RANGE_NAME, lo, hi },
      ends: [
        { yF: hi, classOf: r.highClass.map((c, i) => stressed(c, hi[i])), note: END_NOTE.high },
        { yF: lo, classOf: r.lowClass.map((c, i) => stressed(c, lo[i])), note: END_NOTE.low },
      ],
      order: CCI_KEYS.filter((k) => k !== 'none'),
      label,
      style,
      yName: CCI_AXIS,
      legendTitle: cciLegendTitle(lt),
      refLines,
      tip: (name, y, note) => {
        if (name === CCI_RANGE_NAME) return note ? tipText('Livestock risk', `${note} °F`) : null
        return tipText(`${note ?? ''}: ${sentenceCase(name).toLowerCase()}`, `${y.toFixed(1)} °F`)
      },
    })
  }
  const yF = m.series.valueC.map((v) => cToF(v))
  return indexChart(ctx, {
    xs: m.series.time.map(wallMs),
    yF,
    classOf: m.series.class.map((c, i) => keyOf(c, yF[i])),
    order: CCI_KEYS,
    label,
    style,
    period: m.period,
    yName: CCI_AXIS,
    legendTitle: cciLegendTitle(lt),
    refLines,
    tip: (name, y) => tipText(sentenceCase(name), `${y.toFixed(1)} °F`),
  })
}

export function cciTable(m: CciModel): ChartTable {
  if ('range' in m) {
    const r = m.range
    return {
      caption: `Daily livestock risk (Comprehensive Climate Index) high and low (the day’s highest and lowest hourly value), °F, ${r.livestock} risk class`,
      columns: ['Date', 'High (°F)', 'Risk class at high', 'Low (°F)', 'Risk class at low'],
      rows: r.date.map((d, i) => {
        const hi = cToF(r.highC[i])
        const lo = cToF(r.lowC[i])
        return [d, fmtNum(hi, 1), cciClassText(r.highClass[i], hi) ?? '—', fmtNum(lo, 1), cciClassText(r.lowClass[i], lo) ?? '—']
      }),
    }
  }
  return {
    caption: `Comprehensive Climate Index, °F, ${m.series.livestock} livestock risk class`,
    columns: [m.period === 'hourly' ? 'Time (MT)' : 'Date', CCI_AXIS, 'Risk class'],
    rows: m.series.time.map((t, i) => {
      const f = cToF(m.series.valueC[i])
      return [isoWall(wallMs(t), m.period), fmtNum(f, 1), cciClassText(m.series.class[i], f) ?? '—']
    }),
  }
}
