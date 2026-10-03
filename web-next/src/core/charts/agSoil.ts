/**
 * Soil charts: the Soil Profile heatmap (depth × time for VWC, temperature,
 * EC, SWP or saturation, frozen cells hatched), SWP depth lines on an
 * inverted log axis with field-capacity / wilting-point bands, and percent
 * saturation depth lines. kPa → bar happens here.
 */
import type { EChartsOption, HeatmapSeriesOption, LineSeriesOption } from 'echarts'
import type { LocalDate, LocalDateTime, Nullable, PercentSaturationSeries, SwpSeries } from '../ag/contract'
import { kPaToBar } from '../ag/compute'
import { PROFILE_META, SWP_FIELD_CAPACITY, SWP_WILTING_POINT, type SoilProfileVar, depthLabel } from '../ag/view/labels'
import { HEATMAP, SWP_BANDS, depthColor } from '../palette'
import { grid, logAxis, logExtent, timeAxis, timeZoom, valueAxis } from './axes'
import { MISSING, escapeHtml, fmtNum, fmtWall, isoWall, wallMs, type Period } from './format'
import { colorBar, frozenSeries } from './heatmap'
import { hBandSeries } from './overlays'
import { lineSeries, points } from './series'
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
  const cb = colorBar(ctx, scale, [lo, hi], {
    title: meta.label,
    midpoint: scale.midpoint !== undefined ? toZ(scale.midpoint) : undefined,
    ticks: isLog ? [{ value: Math.log10(SWP_FIELD_CAPACITY), label: `FC (-${SWP_FIELD_CAPACITY})` }] : [],
    fmt,
    seriesIndex: 0,
    bottom: cells.length ? 24 : 4, // compact: under the frozen-soil legend
  })
  const heat: HeatmapSeriesOption = {
    type: 'heatmap',
    name: meta.label,
    data,
    emphasis: { itemStyle: { borderColor: ctx.theme.text, borderWidth: 1 } },
  }
  const g = grid(ctx, { right: cb.gridRight, bottom: ctx.compact ? cb.gridBottom : cells.length ? 92 : 68 })
  const lg = agLegend(ctx, [{ name: FROZEN_NAME }])
  return {
    grid: g,
    xAxis: { type: 'category', data: xMs, axisLabel: { formatter: categoryLabel(m.period), hideOverlap: true }, axisTick: { alignWithLabel: true } },
    yAxis: { type: 'category', data: y, inverse: true, name: 'Soil depth', nameLocation: 'middle', nameGap: 44, nameRotate: 90 },
    visualMap: cb.visualMap,
    graphic: cb.graphic,
    dataZoom: timeZoom(ctx).map((z) => ({ ...z, bottom: z.type === 'slider' ? (cells.length ? 36 : 12) : undefined })),
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
    series: cells.length ? [heat, frozenSeries(ctx, FROZEN_NAME, cells)] : [heat],
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

function depthLines(ctx: ChartContext, xs: number[], depthsCm: number[], values: Nullable[][]): LineSeriesOption[] {
  return depthsCm.map((cm, d) =>
    lineSeries(depthLabel(cm), points(xs, values[d]), { color: depthColor(depthInches(cm), ctx.theme.name) }),
  )
}

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

const toBar = (s: SwpSeries) => s.kPa.map((col) => col.map((v) => kPaToBar(v)))

/**
 * SWP in bar, one line per depth, on a log axis inverted so wet is at the
 * top; ticks read negative ("-15"). Bands shade saturated → field capacity
 * and beyond the wilting point, with corner labels.
 */
export const swpChart: ChartBuilder<SwpModel> = (m, ctx) => {
  const xs = m.series.time.map(wallMs)
  const bar = toBar(m.series)
  const flat = bar.flat().filter((v): v is number => v != null && v > 0)
  const [min, max] = logExtent(Math.min(...flat), Math.max(...flat), [SWP_FIELD_CAPACITY, SWP_WILTING_POINT])
  const lg = agLegend(ctx, m.series.depthsCm.map((cm) => ({ name: depthLabel(cm) })))
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
  return {
    useUTC: true,
    ...liftForLegend(grid(ctx), timeZoom(ctx), lg.extra),
    xAxis: timeAxis(),
    yAxis: logAxis(axisTitle('swp', 'Soil water potential'), min, max, { inverse: true, prefix: '-' }),
    legend: lg.legend,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, m.period), (name, y) => tipText(name, `-${y.toFixed(2)} bar`)),
    series: [...bands, ...depthLines(ctx, xs, m.series.depthsCm, bar)],
  } satisfies EChartsOption
}

export function swpTable(m: SwpModel): ChartTable {
  return depthTable('Soil water potential by depth, bar (negative = suction)', m.period, m.series.time, m.series.depthsCm, toBar(m.series), (v) =>
    v == null ? MISSING : `-${v.toFixed(2)}`,
  )
}

/* ---------------------------------------------------- percent saturation */

export interface PercentSaturationModel {
  series: PercentSaturationSeries
  period: Period
}

export const percentSaturationChart: ChartBuilder<PercentSaturationModel> = (m, ctx) => {
  const xs = m.series.time.map(wallMs)
  const lg = agLegend(ctx, m.series.depthsCm.map((cm) => ({ name: depthLabel(cm) })))
  return {
    useUTC: true,
    ...liftForLegend(grid(ctx), timeZoom(ctx), lg.extra),
    xAxis: timeAxis(),
    yAxis: valueAxis(axisTitle('percent_saturation', 'Soil saturation'), { min: 0, max: 100 }),
    legend: lg.legend,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, m.period), (name, y) => tipText(name, `${y.toFixed(1)} %`)),
    series: depthLines(ctx, xs, m.series.depthsCm, m.series.pct),
  } satisfies EChartsOption
}

export function percentSaturationTable(m: PercentSaturationModel): ChartTable {
  return depthTable('Soil saturation by depth, %', m.period, m.series.time, m.series.depthsCm, m.series.pct, (v) => fmtNum(v, 1))
}
