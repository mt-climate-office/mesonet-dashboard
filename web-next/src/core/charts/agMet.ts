/**
 * Ag Tools met charts: reference ET (bars + cumulative), feels-like and
 * livestock risk (CCI): hourly as an index line + classed markers, daily as
 * each day's low–high range + markers at the stressed ends. Input is the SI
 * contract series; °C → °F and mm → in happen here.
 */
import type { EChartsOption } from 'echarts'
import type { CciClass, CciRangeSeries, CciSeries, EtoSeries, FeelsLikeRangeSeries, FeelsLikeSeries } from '../ag/contract'
import { CCI_HEAT_ONSET_F, cToF, cciColdOnsetF, cciSide, cumulativeSum, mmToIn } from '../ag/compute'
import { CCI_CLASSES, FEELS_LIKE_LABELS, finiteMax } from '../ag/view/labels'
import { CUMULATIVE_LINE, DAILY_RANGE, ETR, FEELS_LIKE, FEELS_LIKE_LINE, INDEX_LINE, type StressSide, cciStyle } from '../palette'
import { dualAxis, valueAxis } from './axes'
import { fmtNum, fmtWall, isoWall, wallMs, type Period } from './format'
import { AUX, barSeries, lineSeries, markerSeries } from './series'
import { DAY, LEGEND_PX, REF_WIDTH, extentOf, plotExtent, points, stepMs, timeFrame, yAxisRange, yBounds } from './style'
import { bandSeries } from './overlays'
import { paint } from './theme'
import { type AgLegendItem, DASH_ICON, agLegend, liftForLegend, sentenceCase } from './agLegend'
import { type TipRow, axisTooltip, tipText } from './tooltip'
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
  // The running total's axis ends just past the total on its own nice steps: aligned to the bars'
  // ticks it ran to 0–70 for a 43 in total. It draws no grid lines, so nothing misreads.
  const [y1, dual] = dualAxis(ETR_AXIS, ETR_CUM_AXIS)
  const y2 = { ...dual, ...yBounds('Reference ET', 0, finiteMax(cumulative)), alignTicks: false }
  return {
    useUTC: true,
    ...liftForLegend(f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    yAxis: [y1, y2, ...(f.trace ? [f.trace.yAxis] : [])],
    legend: lg.legend,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, m.period), (name, y) =>
      tipText(name === 'ETr' ? 'Reference ET' : 'Cumulative', `${y.toFixed(3)} in`),
    ),
    series: [
      ...(f.trace ? [f.trace.series] : []),
      barSeries('ETr', points(xs, inches, step), c.bar),
      lineSeries('Cumulative ETr', cum, { color: paint(ctx.theme, CUMULATIVE_LINE), yAxisIndex: 1 }),
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

/** How the markers of one class draw. */
interface MarkerClass {
  /** Series and legend name; classes may share one, for one legend entry per ramp. */
  group: string
  /** Series id (the fidelity harness pairs CCI classes by it). */
  id?: string
  /** What a point of this class is, for the tooltip ("Severe (cold)", "Feels like (wind chill)"). */
  text: string
  color: string
  symbol: string
}

/** What the index and range charts share: the marker classes, their legend and the reference lines. */
interface MarkerOpts<K extends string> {
  order: readonly K[]
  cls: (k: K) => MarkerClass
  /** The legend entry of a marker group (default: its name), given its classes present. */
  legendItem?: (group: string, classes: MarkerClass[]) => AgLegendItem
  yName: string
  legendTitle?: string
  /** Dashed lines where something starts (CCI stress onsets), labelled right of the plot; `short` on compact screens. */
  refLines?: { y: number; label: string; short: string }[]
  /** Tooltip row for a series name, its y (°F) and the point's note (a marker's class text). */
  tip: TipRow
}

/** One marker series per class present (in `order`); `pts` gives a class's points, each noted for the tooltip. */
function classMarkers<K extends string>(o: MarkerOpts<K>, pts: (k: K) => [number, number, string][], size: number) {
  return o.order.flatMap((k) => {
    const p = pts(k)
    if (p.length === 0) return []
    const c = o.cls(k)
    return [{ k, series: { ...markerSeries(c.group, p, { color: c.color, symbol: c.symbol, size }), ...(c.id ? { id: c.id } : {}) } }]
  })
}

/** Legend entries for the marker groups present, in class order. */
function markerLegend<K extends string>(o: MarkerOpts<K>, present: K[]): AgLegendItem[] {
  const groups = new Map<string, MarkerClass[]>()
  for (const k of present) {
    const c = o.cls(k)
    groups.set(c.group, [...(groups.get(c.group) ?? []), c])
  }
  return [...groups].map(([group, classes]) => o.legendItem?.(group, classes) ?? { name: group, text: sentenceCase(group) })
}

/** "Severe (cold)" → "severe (cold)". */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/**
 * The index line + an optional named comparison line + the class markers + optional reference
 * lines. The index line is a drawing aid (no legend, no tooltip) unless `line` names it: then it is
 * drawn as a data line, listed first in the legend, and its tooltip row carries each point's class.
 */
function indexChart<K extends string>(
  ctx: ChartContext,
  o: MarkerOpts<K> & {
    xs: number[]
    /** Index values (°F): the line and the marker heights. */
    yF: Ys
    /** Name and color of the index line when it is the plotted quantity (feels like). */
    line?: { name: string; color: string }
    /** A second, named line (legend, tooltip), dashed, e.g. the air temperature. */
    compare?: { name: string; yF: Ys; id: string }
    classOf: (K | null)[]
    period: Period
  },
): EChartsOption {
  const size = o.period === 'hourly' ? 5 : 8
  const markers = classMarkers(o, (k) => o.classOf.flatMap((c, i) => (c === k && o.yF[i] != null ? [[o.xs[i], o.yF[i]!, o.cls(k).text] as [number, number, string]] : [])), size)
  const step = stepMs(o.period)
  const line = points(o.xs, o.yF, step)
  const f = timeFrame(ctx, { extent: plotExtent(o.xs, step, false), trace: line, yAxisIndex: 1, legendPx: LEGEND_PX })
  const lg = agLegend(
    ctx,
    [
      ...(o.line ? [{ name: o.line.name }] : []),
      ...(o.compare ? [{ name: o.compare.name, icon: DASH_ICON }] : []),
      ...markerLegend(o, markers.map((m) => m.k)),
    ],
    { title: o.legendTitle },
  )
  // A temperature-equivalent index: a free axis (style yBounds), as air temperature.
  const y = { ...valueAxis(o.yName), ...yAxisRange('Air Temperature', ...extentOf([...o.yF, ...(o.compare?.yF ?? [])])) }
  const dim = paint(ctx.theme, INDEX_LINE)
  const indexLine = o.line
    ? lineSeries(o.line.name, points(o.xs, o.yF, step, o.classOf.map((k) => (k == null ? '' : o.cls(k).text))), { color: o.line.color, id: INDEX_LINE_ID })
    : lineSeries('Index', line, { color: dim, width: REF_WIDTH, id: `${AUX}index-line` })
  const compare = o.compare ? [lineSeries(o.compare.name, points(o.xs, o.compare.yF, step), { color: dim, dash: 'dashed', id: o.compare.id })] : []
  if (o.refLines?.length) indexLine.markLine = refMarkLine(ctx, o.refLines)
  const right = o.refLines?.length ? refGutter(ctx) : undefined
  return {
    useUTC: true,
    ...liftForLegend(right ? { ...f.grid, right } : f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    yAxis: f.trace ? [y, f.trace.yAxis] : y,
    legend: lg.legend,
    graphic: lg.graphic,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, o.period), o.tip),
    series: [...(f.trace ? [f.trace.series] : []), indexLine, ...compare, ...markers.map((m) => m.series)],
  }
}

/**
 * Daily range chart: each day's low–high as a band, and a marker at an end where it is stressed
 * (one series per class, both ends together; each point notes "Daily high: …" / "Daily low: …").
 */
function rangeChart<K extends string>(
  ctx: ChartContext,
  o: MarkerOpts<K> & {
    dates: readonly string[]
    band: { name: string; lo: Ys; hi: Ys }
    /** The ends to mark (°F), each with its class per day (null: no marker) and its tooltip note. */
    ends: { yF: Ys; classOf: (K | null)[]; note: string }[]
  },
): EChartsOption {
  const xs = o.dates.map(wallMs)
  const markers = classMarkers(
    o,
    (k) =>
      o.ends
        .flatMap((e) => e.classOf.flatMap((c, i) => (c === k && e.yF[i] != null ? [[xs[i], e.yF[i]!, `${e.note}: ${lowerFirst(o.cls(k).text)}`] as [number, number, string]] : [])))
        .sort((a, b) => a[0] - b[0]),
    8,
  )
  const hi = points(xs, o.band.hi, DAY)
  const f = timeFrame(ctx, { extent: plotExtent(xs, DAY, false), trace: hi, yAxisIndex: 1, legendPx: LEGEND_PX })
  const lg = agLegend(ctx, [{ name: o.band.name, icon: 'rect' }, ...markerLegend(o, markers.map((m) => m.k))], { title: o.legendTitle })
  const all = [...o.band.lo, ...o.band.hi, ...o.ends.flatMap((e) => e.yF)]
  const y = { ...valueAxis(o.yName), ...yAxisRange('Air Temperature', ...extentOf(all)) }
  // The band is a fill, not a mark (palette DAILY_RANGE): the markers, tooltip and table carry the values.
  const [base, fill] = bandSeries(o.band.name, 'Daily low', xs, o.band.lo, o.band.hi, {
    color: paint(ctx.theme, { ...INDEX_LINE, alpha: DAILY_RANGE.alpha }),
    stack: 'range',
    step: DAY,
  })
  if (o.refLines?.length) base.markLine = refMarkLine(ctx, o.refLines)
  const right = o.refLines?.length ? refGutter(ctx) : undefined
  return {
    useUTC: true,
    ...liftForLegend(right ? { ...f.grid, right } : f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    yAxis: f.trace ? [y, f.trace.yAxis] : y,
    legend: lg.legend,
    graphic: lg.graphic,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, 'daily'), o.tip),
    series: [...(f.trace ? [f.trace.series] : []), base, fill, ...markers.map((m) => m.series)],
  }
}

/**
 * Reference-line label font (px); the labels are two short lines ("Heat stress" / "from 77 °F"),
 * or on compact screens "77 °F" / "heat".
 */
const refFont = (ctx: ChartContext) => (ctx.compact ? 10 : 11)

/**
 * Grid right margin (px) for the reference-line labels beside the plot, so they never sit on the
 * markers (the newest ones are at the right end); a narrow one for the short labels on compact screens.
 */
const refGutter = (ctx: ChartContext): number => (ctx.compact ? 48 : 96)

/** Dashed reference lines, labelled right of the plot (short labels on compact screens). */
function refMarkLine(ctx: ChartContext, lines: { y: number; label: string; short: string }[]) {
  const font = refFont(ctx)
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: paint(ctx.theme, INDEX_LINE), type: 'dashed' as const, width: 1 },
    label: {
      position: 'end' as const,
      distance: ctx.compact ? 4 : 6,
      formatter: '{b}',
      color: ctx.theme.textMuted,
      fontFamily: ctx.theme.fontUi,
      fontSize: font,
      lineHeight: font + 2,
    },
    data: lines.map((l) => ({ yAxis: l.y, name: ctx.compact ? l.short : l.label })),
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
/** Series id of the feels-like line (the fidelity harness pairs it with web/'s index line). */
export const INDEX_LINE_ID = 'feels:index-line'
/** The feels-like line's name (legend, tooltip). */
export const FEELS_LIKE_LINE_NAME = 'Feels like'

/** The air temperature line's name: the daily mean for daily rows. */
export const airTempName = (period: Period) => (period === 'daily' ? 'Average temperature' : 'Air temperature')

/** The daily chart's band: the day's air temperature range (named as the Livestock risk band). */
export const AIR_RANGE_NAME = `Air temperature (${DAILY_RANGE.label.toLowerCase()})`
const END_NOTE = { high: 'Daily high', low: 'Daily low' } as const

/** A tooltip row for a point: its note (what the value is) or the series name, and the value in °F. */
const noteTip = (name: string, y: number, note: string | undefined) => tipText(note || name, `${y.toFixed(1)} °F`)

/**
 * Feels-like °F against the air temperature: the feels-like line (named, in the legend), the air
 * temperature dashed and lighter, and a marker wherever an index applies: wind chill (blue ◆) or
 * heat index (red ▲). Elsewhere the lines coincide (the feels-like temperature is the air
 * temperature). The tooltip lists the feels-like value once, with the index used.
 */
export const feelsLikeChart: ChartBuilder<FeelsLikeModel> = (m, ctx) => {
  const kind = new Map<string, string>(MARKED.map((k) => [FEELS_LIKE_MARKERS[k], FEELS_LIKE_LABELS[k]]))
  const feels = (name: string) => `Feels like (${sentenceCase(kind.get(name) ?? name).toLowerCase()})`
  const cls = (k: (typeof MARKED)[number]): MarkerClass => ({ group: FEELS_LIKE_MARKERS[k], text: feels(FEELS_LIKE_MARKERS[k]), ...FEELS_LIKE[ctx.theme.name][k] })
  if ('range' in m) return feelsLikeRangeChart(m.range, ctx, cls)
  const air = airTempName(m.period)
  return indexChart(ctx, {
    xs: m.series.time.map(wallMs),
    yF: m.series.valueC.map((v) => cToF(v)),
    line: { name: FEELS_LIKE_LINE_NAME, color: paint(ctx.theme, FEELS_LIKE_LINE) },
    compare: { name: air, yF: m.series.airC.map((v) => cToF(v)), id: AIR_TEMP_ID },
    classOf: m.series.regime.map((r) => (r === 'wind_chill' || r === 'heat_index' ? r : null)),
    order: MARKED,
    cls,
    period: m.period,
    yName: axisTitle('feels_like', 'Feels like'),
    // The line's row names the index; a marker would repeat it.
    tip: (name, y, note) => (name === air || name === FEELS_LIKE_LINE_NAME ? noteTip(name, y, note) : null),
  })
}

/**
 * Daily feels like: the day's air temperature range as a band; a heat index at the day's high
 * (red ▲) and a wind chill at its low (blue ◆) show what it felt like against that range.
 */
function feelsLikeRangeChart(r: FeelsLikeRangeSeries, ctx: ChartContext, cls: (k: (typeof MARKED)[number]) => MarkerClass): EChartsOption {
  const f = (xs: readonly (number | null)[]) => xs.map((v) => cToF(v))
  return rangeChart(ctx, {
    dates: r.date,
    band: { name: AIR_RANGE_NAME, lo: f(r.airLowC), hi: f(r.airHighC) },
    ends: [
      { yF: f(r.highC), classOf: r.highRegime.map((g) => (g === 'heat_index' ? g : null)), note: END_NOTE.high },
      { yF: f(r.lowC), classOf: r.lowRegime.map((g) => (g === 'wind_chill' ? g : null)), note: END_NOTE.low },
    ],
    order: MARKED,
    cls,
    yName: axisTitle('feels_like', 'Feels like'),
    tip: (name, y, note) => {
      if (name === AIR_RANGE_NAME) return note ? tipText('Air temperature', `${note} °F`) : null
      return noteTip(name, y, note)
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

/** The daily chart's band: the day's index range (named as the Feels like band). */
export const CCI_RANGE_NAME = `Livestock risk (${DAILY_RANGE.label.toLowerCase()})`

export const cciLegendTitle = (livestock: CciSeries['livestock']) =>
  `${plainName('cci', 'Livestock risk')} (${livestock === 'newborn' ? 'newborn' : 'adult'})`

/** The legend's marker groups: one entry per side (its classes as a color ramp), and no stress. */
export const CCI_GROUPS = { cold: 'Cold stress', heat: 'Heat stress', none: 'No stress' } as const

type CciKey = `${StressSide}:${CciClass}` | 'none'
const STRESS = CCI_CLASSES.slice(1)
/** Drawing order, cold to hot: worst cold … mild cold, no stress, mild heat … worst heat. */
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

/** Series id of a class's markers: "cci:Severe (cold)". */
const cciId = (cls: CciClass, side?: StressSide) => `cci:${cls}${side ? ` (${side})` : ''}`
const classOfId = (id: string | undefined) => (id ?? '').replace(/^cci:/, '').replace(/ \((cold|heat)\)$/, '') as CciClass

/** One legend entry per side: its symbol filled with its classes' ramp, "Cold stress (mild → extreme danger)". */
function cciLegendItem(group: string, classes: MarkerClass[]): AgLegendItem {
  if (group === CCI_GROUPS.none) return { name: group }
  const sorted = [...classes].sort((a, b) => CCI_CLASSES.indexOf(classOfId(a.id)) - CCI_CLASSES.indexOf(classOfId(b.id)))
  const first = classOfId(sorted[0].id).toLowerCase()
  const last = classOfId(sorted[sorted.length - 1].id).toLowerCase()
  return {
    name: group,
    text: `${group} (${first}${sorted.length > 1 ? ` → ${last}` : ''})`,
    short: group,
    icon: sorted[0].symbol,
    color: sorted.length > 1 ? { stops: sorted.map((c) => c.color) } : sorted[0].color,
  }
}

/**
 * Livestock risk index °F: grey line + markers by class, blues for cold stress and reds for heat
 * stress (palette `cciStyle`), and dashed lines where cold and heat stress start for the animal.
 * The legend has one ramp entry per side; the tooltip and table name each point's class.
 */
export const cciChart: ChartBuilder<CciModel> = (m, ctx) => {
  const lt = 'range' in m ? m.range.livestock : m.series.livestock
  const cls = (k: CciKey): MarkerClass => {
    if (k === 'none') return { group: CCI_GROUPS.none, id: cciId('No Stress'), text: 'No stress', ...cciStyle('No Stress', 'cold', ctx.theme.name) }
    const side = k.slice(0, k.indexOf(':')) as StressSide
    const c = k.slice(k.indexOf(':') + 1) as CciClass
    return { group: CCI_GROUPS[side], id: cciId(c, side), text: `${sentenceCase(c)} (${side})`, ...cciStyle(c, side, ctx.theme.name) }
  }
  const refLines = [
    { y: CCI_HEAT_ONSET_F, label: `Heat stress\nfrom ${CCI_HEAT_ONSET_F} °F`, short: `${CCI_HEAT_ONSET_F} °F\nheat` },
    { y: cciColdOnsetF(lt), label: `Cold stress\nbelow ${cciColdOnsetF(lt)} °F`, short: `${cciColdOnsetF(lt)} °F\ncold` },
  ]
  if ('range' in m) {
    // Daily: the band is the day's range; only a stressed end gets a marker.
    const r = m.range
    const hi = r.highC.map((v) => cToF(v))
    const lo = r.lowC.map((v) => cToF(v))
    const stressed = (c: CciClass | null, f: number | null) => (c === 'No Stress' ? null : keyOf(c, f))
    return rangeChart(ctx, {
      dates: r.date,
      band: { name: CCI_RANGE_NAME, lo, hi },
      ends: [
        { yF: hi, classOf: r.highClass.map((c, i) => stressed(c, hi[i])), note: END_NOTE.high },
        { yF: lo, classOf: r.lowClass.map((c, i) => stressed(c, lo[i])), note: END_NOTE.low },
      ],
      order: CCI_KEYS.filter((k) => k !== 'none'),
      cls,
      legendItem: cciLegendItem,
      yName: CCI_AXIS,
      legendTitle: cciLegendTitle(lt),
      refLines,
      tip: (name, y, note) => {
        if (name === CCI_RANGE_NAME) return note ? tipText('Livestock risk', `${note} °F`) : null
        return noteTip(name, y, note)
      },
    })
  }
  const yF = m.series.valueC.map((v) => cToF(v))
  return indexChart(ctx, {
    xs: m.series.time.map(wallMs),
    yF,
    classOf: m.series.class.map((c, i) => keyOf(c, yF[i])),
    order: CCI_KEYS,
    cls,
    legendItem: cciLegendItem,
    period: m.period,
    yName: CCI_AXIS,
    legendTitle: cciLegendTitle(lt),
    refLines,
    tip: noteTip,
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
