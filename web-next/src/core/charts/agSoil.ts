/**
 * Soil charts: the Soil Profile heatmap (depth × time for VWC, temperature,
 * EC, SWP or saturation, frozen cells hatched), SWP depth lines on an
 * inverted log axis with field-capacity / wilting-point bands, and percent
 * saturation depth lines. kPa → bar happens here.
 */
import type { EChartsOption, HeatmapSeriesOption, LineSeriesOption } from 'echarts'
import type { LocalDate, LocalDateTime, Nullable, PercentSaturationSeries, SwpSeries } from '../ag/contract'
import { PROFILE_META, SWP_CAP_BAR, SWP_FIELD_CAPACITY, SWP_WILTING_POINT, type SoilProfileVar, depthLabel, swpBar, swpText } from '../ag/view/labels'
import { HEATMAP, SWP_BANDS, depthColor } from '../palette'
import { grid, logAxis, logExtent, valueAxis } from './axes'
import { MISSING, escapeHtml, fmtNum, fmtWall, isoWall, wallMs, type Period } from './format'
import { colorBar, frozenSeries } from './heatmap'
import { hBandSeries } from './overlays'
import { lineSeries } from './series'
import { LEGEND_PX, bottomLayout, plotExtent, points, showsSlider, stepMs, timeFrame, timeZoom, valued, zoomTrace, type Point } from './style'
import { agLegend, liftForLegend } from './agLegend'
import { axisTooltip, tipText, tooltipBase } from './tooltip'
import type { ChartBuilder, ChartContext, ChartTable } from './types'
import { axisTitle } from '../variables/labels'

/** Nominal inches of a sensor depth (91 cm → 36), for depthColor. */
const depthInches = (cm: number) => Number.parseInt(depthLabel(cm), 10)

/* ------------------------------------------------------- Soil profile */

export interface SoilProfileModel {
  variable: SoilProfileVar
  time: (LocalDate | LocalDateTime)[]
  depthsCm: number[]
  /** Display units (°F, %, mS/cm, bar), already frozen-masked; `values[d][i]`. */
  values: Nullable[][]
  /** `frozen[d][i]`: cells hidden by the frozen-soil mask. */
  frozen?: boolean[][]
  /** `hasData[d]` false drops depth d even if it has frozen cells (no probe ≠ frozen). */
  hasData?: boolean[]
  period: Period
}

export const FROZEN_NAME = 'Frozen soil (≤ 32 °F)'

/** Depth indices drawn: has data before masking, and a value or a frozen cell. */
function keptDepths(m: SoilProfileModel): number[] {
  return m.depthsCm
    .map((_, d) => d)
    .filter((d) => m.hasData?.[d] !== false && (m.values[d].some((v) => v != null) || !!m.frozen?.[d]?.some(Boolean)))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Category value (wall-clock ms) → "Jul 1", or "Jul 1\n14:00" for hourly cells. */
const categoryLabel = (period: Period) => (v: string | number) => {
  const d = new Date(Number(v))
  const day = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  return period === 'hourly' ? `${day}\n${String(d.getUTCHours()).padStart(2, '0')}:00` : day
}

export const soilProfileChart: ChartBuilder<SoilProfileModel> = (m, ctx) => {
  const keep = keptDepths(m)
  if (keep.length === 0 || m.time.length === 0) return { series: [] }
  const meta = PROFILE_META[m.variable]
  const scale = HEATMAP[m.variable]
  const isLog = m.variable === 'swp'
  // Category data are wall-clock ms, so the host can report and apply zoom in ms (core/charts/zoom.ts).
  const xMs = m.time.map(wallMs)
  const y = keep.map((d) => depthLabel(m.depthsCm[d]))
  const toZ = (v: number) => (isLog ? Math.log10(v) : v)
  const data: [number, number, number][] = []
  let lo = Infinity
  let hi = -Infinity
  keep.forEach((d, yi) =>
    m.values[d].forEach((v, xi) => {
      if (v == null || (isLog && !(v > 0))) return
      const z = toZ(v)
      data.push([xi, yi, z])
      if (z < lo) lo = z
      if (z > hi) hi = z
    }),
  )
  if (!Number.isFinite(lo)) lo = hi = scale.midpoint !== undefined ? toZ(scale.midpoint) : 0
  // SWP colors span at most 0.01–1000 bar; drier/wetter cells saturate (inversion blows up near residual VWC).
  if (isLog) [lo, hi] = [Math.max(lo, -2), Math.min(hi, 3)]
  const digits = m.variable === 'soil_blk_ec' || isLog ? 2 : 1
  const fmt = (z: number) => (isLog ? `-${Number((10 ** z).toPrecision(2))}` : z.toFixed(m.variable === 'soil_blk_ec' ? 2 : 0))
  const cells: [number, number][] = []
  keep.forEach((d, yi) => m.frozen?.[d]?.forEach((f, xi) => f && cells.push([xi, yi])))
  // The slider (wide screens, enough cells) traces the shallowest depth, wet up for SWP as its line chart.
  const tracePts: Point[] = m.values[keep[0]].map((v, xi) => [xi, v == null || (isLog && !(v > 0)) ? null : isLog ? -toZ(v) : v])
  const slider = showsSlider(ctx, [0, xMs.length - 1], valued(tracePts), false)
  const trace = slider ? zoomTrace(tracePts, null, { yAxisIndex: 1 }) : null
  const cb = colorBar(ctx, scale, [lo, hi], {
    title: meta.label,
    midpoint: scale.midpoint !== undefined ? toZ(scale.midpoint) : undefined,
    ticks: isLog ? [{ value: Math.log10(SWP_FIELD_CAPACITY), label: `FC (-${SWP_FIELD_CAPACITY})` }] : [],
    fmt,
    seriesIndex: trace ? 1 : 0,
    bottom: cells.length ? 24 : 4, // compact: under the frozen-soil legend
  })
  const heat: HeatmapSeriesOption = {
    type: 'heatmap',
    name: meta.label,
    data,
    emphasis: { itemStyle: { borderColor: ctx.theme.text, borderWidth: 1 } },
  }
  // Hourly cells have two-line labels ("Jul 1" over "14:00").
  const b = bottomLayout(slider, cells.length ? LEGEND_PX : 0, m.period === 'hourly' ? 42 : 30)
  const g = grid(ctx, { right: cb.gridRight, bottom: ctx.compact ? cb.gridBottom : b.grid })
  const lg = agLegend(ctx, [{ name: FROZEN_NAME }])
  return {
    grid: g,
    xAxis: { type: 'category', data: xMs, axisLabel: { formatter: categoryLabel(m.period), hideOverlap: true }, axisTick: { alignWithLabel: true } },
    yAxis: [{ type: 'category', data: y, inverse: true, name: 'Soil depth', nameLocation: 'middle', nameGap: 44, nameRotate: 90 }, ...(trace ? [trace.yAxis] : [])],
    visualMap: cb.visualMap,
    graphic: cb.graphic,
    dataZoom: timeZoom(ctx, { extent: [0, xMs.length - 1], slider, sliderBottom: b.slider }),
    legend: cells.length ? lg.legend : { show: false },
    tooltip: {
      ...tooltipBase(ctx),
      trigger: 'item',
      formatter: ((p: { seriesType?: string; value?: number[] }) => {
        const [xi, yi, z] = p.value ?? []
        const head = `<div class="tooltip-name">${escapeHtml(fmtWall(xMs[xi], m.period))}</div>`
        if (p.seriesType === 'custom') return `${head}${escapeHtml(y[yi])}: ${escapeHtml(FROZEN_NAME)}, value hidden`
        const v = isLog ? `-${(10 ** z).toFixed(2)}` : z.toFixed(digits)
        return `${head}${tipText(y[yi], `${v} ${meta.units}`)}`
      }) as never,
    },
    series: [...(trace ? [trace.series] : []), heat, ...(cells.length ? [frozenSeries(ctx, FROZEN_NAME, cells)] : [])],
  } satisfies EChartsOption
}

export function soilProfileTable(m: SoilProfileModel): ChartTable {
  const meta = PROFILE_META[m.variable]
  const keep = keptDepths(m)
  const digits = m.variable === 'soil_blk_ec' || m.variable === 'swp' ? 2 : 1
  return {
    caption: `Soil profile: ${meta.label} by depth`,
    columns: [m.period === 'hourly' ? 'Time (MT)' : 'Date', ...keep.map((d) => depthLabel(m.depthsCm[d]))],
    rows: m.time.map((t, i) => [
      isoWall(wallMs(t), m.period),
      ...keep.map((d) => {
        const v = m.values[d][i]
        if (v == null) return m.frozen?.[d]?.[i] ? 'frozen' : MISSING
        return m.variable === 'swp' ? `-${v.toFixed(digits)}` : v.toFixed(digits)
      }),
    ]),
  }
}

/* ------------------------------------------------------- depth lines */

/** One line per depth, shallow → deep, in the depth's own color (style LINE_WIDTH, gaps at `step`). */
function depthLines(ctx: ChartContext, xs: number[], depthsCm: number[], values: Nullable[][], step: number): LineSeriesOption[] {
  return depthsCm.map((cm, d) =>
    lineSeries(depthLabel(cm), points(xs, values[d], step), { color: depthColor(depthInches(cm), ctx.theme.name) }),
  )
}

/** The index of the shallowest depth (the slider's trace). */
const shallowest = (depthsCm: number[]) => depthsCm.indexOf(Math.min(...depthsCm))

function depthTable(caption: string, period: Period, time: string[], depthsCm: number[], values: Nullable[][], f: (v: Nullable) => string): ChartTable {
  return {
    caption,
    columns: [period === 'hourly' ? 'Time (MT)' : 'Date', ...depthsCm.map(depthLabel)],
    rows: time.map((t, i) => [isoWall(wallMs(t), period), ...depthsCm.map((_, d) => f(values[d][i]))]),
  }
}

/* ------------------------------------------------------------------ SWP */

export interface SwpModel {
  series: SwpSeries
  period: Period
}

/** Point notes on the dry-end companion lines: a capped lower bound, or the joint to the solid line. */
const DRY = 'dry'
const JOINT = 'joint'

/**
 * Per depth, the solid line (dry-end clips nulled) and, when there are any,
 * a dashed, faded companion in the same color and name (one legend entry)
 * through the dry-end clips, joined to the solid line's neighbouring points.
 */
function swpLines(ctx: ChartContext, xs: number[], depthsCm: number[], bar: Nullable[][], dry: boolean[][], step: number): LineSeriesOption[] {
  return depthsCm.flatMap((cm, d) => {
    const color = depthColor(depthInches(cm), ctx.theme.name)
    const name = depthLabel(cm)
    const solid = lineSeries(name, points(xs, bar[d].map((v, i) => (dry[d][i] ? null : v)), step), { color })
    if (!dry[d].some(Boolean)) return [solid]
    const near = (i: number) => dry[d][i] || !!dry[d][i - 1] || !!dry[d][i + 1]
    const ys = bar[d].map((v, i) => (near(i) ? v : null))
    const notes = dry[d].map((x) => (x ? DRY : JOINT))
    const faded = lineSeries(name, points(xs, ys, step, notes), { color, dash: 'dashed' })
    return [solid, { ...faded, lineStyle: { ...faded.lineStyle, opacity: 0.55 } }]
  })
}

/**
 * SWP in bar, one line per depth, on a log axis inverted so wet is at the
 * top; ticks read negative ("-15"). Bands shade saturated → field capacity
 * and beyond the wilting point, with corner labels. Dry-end clips (VWC below
 * the lab range) are capped (labels `SWP_CAP_BAR`) and drawn dashed and faded.
 */
export const swpChart: ChartBuilder<SwpModel> = (m, ctx) => {
  const xs = m.series.time.map(wallMs)
  const { bar, dry } = swpBar(m.series)
  const flat = bar.flat().filter((v): v is number => v != null && v > 0)
  const [min, decade] = logExtent(Math.min(...flat), Math.max(...flat), [SWP_FIELD_CAPACITY, SWP_WILTING_POINT])
  // Capped dry-end points sit on SWP_CAP_BAR: one more decade keeps them off the frame, ticks on decades.
  const max = dry.some((col) => col.some(Boolean)) && decade <= SWP_CAP_BAR ? SWP_CAP_BAR * 10 : decade
  const lg = agLegend(ctx, m.series.depthsCm.map((cm) => ({ name: depthLabel(cm) })))
  const step = stepMs(m.period)
  // The slider traces the shallowest depth, wet up as the inverted log axis draws it.
  const top = bar[shallowest(m.series.depthsCm)] ?? []
  const trace = points(xs, top.map((v) => (v != null && v > 0 ? -Math.log10(v) : null)), step)
  const f = timeFrame(ctx, { extent: plotExtent(xs, step, false), trace, yAxisIndex: 1, legendPx: LEGEND_PX })
  const bands =
    xs.length > 0
      ? [
          hBandSeries(
            ctx,
            [xs[0], xs[xs.length - 1]],
            [
              { from: min, to: SWP_FIELD_CAPACITY, label: SWP_BANDS.labels.fieldCapacity, labelAt: 'insideTopLeft' },
              { from: SWP_WILTING_POINT, to: max, label: SWP_BANDS.labels.wiltingPoint, labelAt: 'insideBottomLeft' },
            ],
            [
              { y: SWP_FIELD_CAPACITY, label: `Field Capacity (${SWP_FIELD_CAPACITY} bar)` },
              { y: SWP_WILTING_POINT, label: `Wilting Point (${SWP_WILTING_POINT} bar)` },
            ],
          ),
        ]
      : []
  const y = logAxis(axisTitle('swp', 'Soil water potential'), min, max, { inverse: true, prefix: '-' })
  return {
    useUTC: true,
    ...liftForLegend(f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    yAxis: f.trace ? [y, f.trace.yAxis] : y,
    legend: lg.legend,
    // A joint point repeats the solid line's value: list it once.
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, m.period), (name, y, note) => (note === JOINT ? null : tipText(name, swpText(y, note === DRY)))),
    series: [...(f.trace ? [f.trace.series] : []), ...bands, ...swpLines(ctx, xs, m.series.depthsCm, bar, dry, step)],
  } satisfies EChartsOption
}

export function swpTable(m: SwpModel): ChartTable {
  const { bar, dry } = swpBar(m.series)
  const t = depthTable('Soil water potential by depth, bar (negative = suction)', m.period, m.series.time, m.series.depthsCm, bar, (v) =>
    v == null ? MISSING : `-${v.toFixed(2)}`,
  )
  // Dry-end clips are lower bounds on suction: "≤ -1000.00".
  t.rows.forEach((row, i) => m.series.depthsCm.forEach((_, d) => dry[d][i] && (row[d + 1] = `≤ ${row[d + 1]}`)))
  return t
}

/* ---------------------------------------------------- percent saturation */

export interface PercentSaturationModel {
  series: PercentSaturationSeries
  period: Period
}

export const percentSaturationChart: ChartBuilder<PercentSaturationModel> = (m, ctx) => {
  const xs = m.series.time.map(wallMs)
  const lg = agLegend(ctx, m.series.depthsCm.map((cm) => ({ name: depthLabel(cm) })))
  const step = stepMs(m.period)
  const trace = points(xs, m.series.pct[shallowest(m.series.depthsCm)] ?? [], step)
  const f = timeFrame(ctx, { extent: plotExtent(xs, step, false), trace, yAxisIndex: 1, legendPx: LEGEND_PX })
  // A closed 0–100 % scale, as relative humidity (style FIXED).
  const y = { ...valueAxis(axisTitle('percent_saturation', 'Soil saturation'), { min: 0, max: 100 }), interval: 25 }
  return {
    useUTC: true,
    ...liftForLegend(f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    yAxis: f.trace ? [y, f.trace.yAxis] : y,
    legend: lg.legend,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, m.period), (name, y) => tipText(name, `${y.toFixed(1)} %`)),
    series: [...(f.trace ? [f.trace.series] : []), ...depthLines(ctx, xs, m.series.depthsCm, m.series.pct, step)],
  } satisfies EChartsOption
}

export function percentSaturationTable(m: PercentSaturationModel): ChartTable {
  return depthTable('Soil saturation by depth, %', m.period, m.series.time, m.series.depthsCm, m.series.pct, (v) => fmtNum(v, 1))
}
