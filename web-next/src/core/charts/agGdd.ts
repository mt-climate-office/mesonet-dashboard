/**
 * Growing degree days: daily bars (y1) + cumulative line (y2) with labelled
 * growth-stage markLines, and an optional projection (NWS forecast segment,
 * then normals median with a q25–q75 band) continuing from the last
 * observed day. With a stage table, bars, line and projection are colored by
 * the growth stage reached that day (a hidden piecewise visualMap on x).
 * GDD values are already °F·day (contract), so no conversion.
 */
import type { EChartsOption, LineSeriesOption, VisualMapComponentOption } from 'echarts'
import type { GddProjection, GddSeries, GddStage, Nullable } from '../ag/contract'
import { finiteMax, stageText } from '../ag/view/labels'
import { GDD, GDD_STAGE_LINE, gddStageColors, withAlpha } from '../palette'
import { dualAxis, niceCeil } from './axes'
import { fmtNum, fmtWall, wallMs } from './format'
import { bandSeries, labelledLines } from './overlays'
import { barSeries, lineSeries } from './series'
import { DAY, LEGEND_PX, plotExtent, points, timeFrame } from './style'
import { paint } from './theme'
import { agLegend, liftForLegend } from './agLegend'
import { axisTooltip, tipText } from './tooltip'
import type { ChartBuilder, ChartTable } from './types'

export interface GddModel {
  series: GddSeries
  /** Display cutoffs (°F) for the bar name; Infinity = no upper cap. */
  cutoffsF: readonly [number, number]
  /** Crop with a stage table, crop without one, or custom cutoffs. */
  stageMode: 'table' | 'no-table' | 'custom'
  /** Crop display name for "No stage table for …". */
  cropLabel?: string
  /** The crop's stage table, drawn as labelled lines on the cumulative axis. */
  stages?: GddStage[]
  projection?: GddProjection
}

export const GDD_NAMES = {
  cumulative: 'Cumulative GDDs',
  q25: 'Projected 25th percentile',
  band: 'Projected range (normals 25th–75th pct.)',
  forecast: 'Projected (NWS forecast)',
  normals: 'Projected (normals median)',
} as const

/** Legend names on phones, short enough for one row (the series keep their full names). */
const SHORT: Record<string, string> = {
  [GDD_NAMES.cumulative]: 'Cumulative',
  [GDD_NAMES.band]: 'Range',
  [GDD_NAMES.forecast]: 'Forecast',
  [GDD_NAMES.normals]: 'Normals',
}

/** Stage label font size (px) in the gutter right of the plot. */
const STAGE_FONT = 10

/**
 * Width (px) of a gutter right of the plot for the stage labels, so they
 * never sit on the daily bars; 0 when the longest label would take more than
 * a quarter of the chart (phones, tablets): the lines then go unlabelled and
 * the tooltip, table and stats card name the stage.
 */
export function stageGutter(lines: { label: string }[], width: number): number {
  if (lines.length === 0) return 0
  const w = Math.ceil(Math.max(...lines.map((l) => l.label.length)) * STAGE_FONT * 0.5) + 12
  return w <= width / 4 ? w : 0
}

const fmtF = (f: number) => (Number.isFinite(f) ? `${f}` : '∞')

/** "Daily GDDs (32–∞ °F)". */
export const gddBarName = (cutoffsF: readonly [number, number]) => `Daily GDDs (${fmtF(cutoffsF[0])}–${fmtF(cutoffsF[1])} °F)`

/** Per-day growth-stage text for the tooltip and table. */
function stageLabels(m: GddModel): string[] {
  if (m.stageMode === 'custom') return m.series.date.map(() => 'n/a (custom cutoffs)')
  if (m.stageMode === 'no-table') {
    const crop = (m.cropLabel ?? 'this crop').toLowerCase()
    return m.series.date.map(() => `No stage table for ${crop}`)
  }
  return m.series.date.map((_, i) => stageText(m.series.stage[i], m.series.stageName[i]) || '—')
}

function lastIndex(v: Nullable[]): number {
  for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return i
  return -1
}

/** Projection series, each anchored so the overlay visibly continues the observed line. */
function projectionSeries(m: GddModel, p: GddProjection, colors: { line: string; band: string }): LineSeriesOption[] {
  const s = m.series
  const a = lastIndex(s.cumulative)
  const ax = a >= 0 ? [wallMs(s.date[a])] : []
  const ay = a >= 0 ? [s.cumulative[a]] : []
  const px = p.date.map(wallMs)
  const stage = p.date.map((_, i) =>
    m.stageMode === 'table' ? stageText(p.stage[i], p.stageName[i]) || '—' : stageLabels(m)[0] ?? '',
  )
  const fc = p.basis.flatMap((b, i) => (b === 'forecast' ? [i] : []))
  const nm = p.basis.flatMap((b, i) => (b === 'normals' ? [i] : []))
  const seg = (ix: number[], start: { x: number[]; y: Nullable[] }) =>
    points(
      [...start.x, ...ix.map((i) => px[i])],
      [...start.y, ...ix.map((i) => p.cumulative[i])],
      DAY,
      [...start.x.map(() => ''), ...ix.map((i) => stage[i])],
    )
  const out: LineSeriesOption[] = []
  if (nm.length > 0) {
    out.push(
      ...bandSeries(GDD_NAMES.band, GDD_NAMES.q25, [...ax, ...px], [...ay, ...p.cumulativeQ25], [...ay, ...p.cumulativeQ75], {
        color: colors.band,
        yAxisIndex: 1,
        stack: 'gdd-proj',
        step: DAY,
      }),
    )
  }
  if (fc.length > 0) {
    out.push(lineSeries(GDD_NAMES.forecast, seg(fc, { x: ax, y: ay }), { color: colors.line, dash: 'dotted', yAxisIndex: 1 }))
  }
  if (nm.length > 0) {
    const lastFc = fc.length > 0 ? fc[fc.length - 1] : -1
    const start = lastFc >= 0 ? { x: [px[lastFc]], y: [p.cumulative[lastFc]] } : { x: ax, y: ay }
    out.push(lineSeries(GDD_NAMES.normals, seg(nm, start), { color: colors.line, dash: 'dashed', yAxisIndex: 1 }))
  }
  return out
}

/**
 * Stage lines within (0, y2max], thinned so labels never stack: a stage
 * closer than y2max / 16 to the last kept one is skipped (its name still
 * shows in the tooltip and table).
 */
export function stageLines(stages: GddStage[], y2max: number): { y: number; label: string }[] {
  const out: { y: number; label: string }[] = []
  for (const s of [...stages].sort((a, b) => a.gdd - b.gdd)) {
    if (s.gdd <= 0 || s.gdd > y2max) continue
    if (out.length && s.gdd - out[out.length - 1].y < y2max / 16) continue
    out.push({ y: s.gdd, label: stageText(s.code ?? s.stage, s.name) })
  }
  return out
}

/** How many of `stages` a cumulative total has reached (0 = none yet); null for a missing total. */
export function stageIndex(stages: readonly GddStage[], cumulative: Nullable): number | null {
  if (cumulative == null) return null
  return stages.filter((s) => s.gdd <= cumulative).length
}

/**
 * Pieces for a visualMap on x: one per run of days at the same stage, spanning those whole days
 * (wall-clock midnight to midnight, so the noon-centred points fall inside), in `colors[stage]`.
 * A missing total keeps the stage before it.
 */
export function stagePieces(
  dates: readonly string[],
  cumulative: readonly Nullable[],
  stages: readonly GddStage[],
  colors: readonly string[],
): { gte: number; lt: number; color: string }[] {
  const out: { gte: number; lt: number; color: string; ix: number }[] = []
  let prev = 0
  dates.forEach((d, i) => {
    const ix = stageIndex(stages, cumulative[i]) ?? prev
    prev = ix
    const x = wallMs(d) - DAY / 2 // wallMs puts a date at noon
    const last = out[out.length - 1]
    if (last && last.ix === ix && last.lt === x) last.lt = x + DAY
    else out.push({ gte: x, lt: x + DAY, color: colors[Math.min(ix, colors.length - 1)], ix })
  })
  return out.map(({ gte, lt, color }) => ({ gte, lt, color }))
}

/** Upper bound of the cumulative axis: covers observed, projected and the q75 envelope. */
export function gddAxisMax(m: GddModel): number {
  const p = m.projection
  const top = Math.max(finiteMax(m.series.cumulative), p ? finiteMax(p.cumulative) : 0, p ? finiteMax(p.cumulativeQ75) : 0)
  return niceCeil(top * 1.02)
}

export const gddChart: ChartBuilder<GddModel> = (m, ctx) => {
  const c = GDD[ctx.theme.name]
  const xs = m.series.date.map(wallMs)
  const stages = stageLabels(m)
  const y2max = gddAxisMax(m)
  const table = m.stageMode === 'table' ? [...(m.stages ?? [])].sort((a, b) => a.gdd - b.gdd) : []
  // One color per stage (index 0: before the first); the series take the stage reached so far,
  // so the legend shows the current one.
  const stageColors = table.length > 0 ? gddStageColors(table.length + 1, ctx.theme.name) : []
  const nowStage = stageIndex(table, m.series.cumulative[lastIndex(m.series.cumulative)] ?? null) ?? 0
  const barColor = stageColors[nowStage] ?? c.bar
  const lineColor = stageColors[nowStage] ?? c.cumulative
  const cumPoints = points(xs, m.series.cumulative, DAY, stages)
  const cumulative = lineSeries(GDD_NAMES.cumulative, cumPoints, {
    color: lineColor,
    yAxisIndex: 1,
  })
  const lines = stageLines(table, y2max)
  const gutter = stageGutter(lines, ctx.width)
  if (lines.length > 0) {
    const ml = labelledLines(paint(ctx.theme, GDD_STAGE_LINE), lines, ctx, { labels: gutter > 0, fontSize: STAGE_FONT })
    // Each stage line in its stage's color (the labels stay muted text).
    if (stageColors.length > 0) {
      ml.data = lines.map((l) => ({ yAxis: l.y, name: l.label, lineStyle: { color: stageColors[stageIndex(table, l.y) ?? 0] } }))
    }
    cumulative.markLine = ml
  }
  const proj =
    m.projection && m.projection.date.length > 0
      ? projectionSeries(m, m.projection, { line: lineColor, band: withAlpha(c.cumulative, c.bandAlpha) })
      : []
  const barName = gddBarName(m.cutoffsF)
  const lg = agLegend(ctx, [
    { name: barName, short: 'Daily' },
    { name: GDD_NAMES.cumulative, short: SHORT[GDD_NAMES.cumulative] },
    ...proj.flatMap((s) =>
      s.name === GDD_NAMES.q25 ? [] : [{ name: String(s.name), short: SHORT[String(s.name)], icon: s.name === GDD_NAMES.band ? 'rect' : undefined }],
    ),
  ])
  const [y1, y2] = dualAxis('Daily GDD (°F)', 'Cumulative GDD (°F)', { rightMax: y2max })
  // The slider traces the cumulative GDDs, over the observed days and any projection.
  const allXs = [...xs, ...(m.projection?.date.map(wallMs) ?? [])]
  const f = timeFrame(ctx, { extent: plotExtent(allXs, DAY, true), trace: cumPoints, yAxisIndex: 2, legendPx: LEGEND_PX, right: 64 + gutter })
  const series = [...(f.trace ? [f.trace.series] : []), barSeries(barName, points(xs, m.series.daily, DAY), barColor), cumulative, ...proj]
  let visualMap: VisualMapComponentOption | undefined
  if (stageColors.length > 0) {
    const p = m.projection
    const colored = series.flatMap((s, i) => (s.name === barName || s.name === GDD_NAMES.cumulative || s.name === GDD_NAMES.forecast || s.name === GDD_NAMES.normals ? [i] : []))
    // An explicit line color would win over the visualMap's.
    for (const i of colored) {
      const ls = (series[i] as LineSeriesOption).lineStyle
      if (ls) delete ls.color
    }
    visualMap = {
      type: 'piecewise',
      show: false,
      dimension: 0,
      seriesIndex: colored,
      pieces: stagePieces([...m.series.date, ...(p?.date ?? [])], [...m.series.cumulative, ...(p?.cumulative ?? [])], table, stageColors),
      outOfRange: { color: lineColor },
    }
  }
  return {
    useUTC: true,
    ...liftForLegend(f.grid, f.dataZoom, lg.extra),
    xAxis: f.xAxis,
    // The cumulative axis moves right of the stage-label gutter.
    yAxis: [y1, gutter > 0 ? { ...y2, offset: gutter } : y2, ...(f.trace ? [f.trace.yAxis] : [])],
    legend: lg.legend,
    ...(visualMap ? { visualMap } : {}),
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, 'daily'), (name, y, note) => {
      if (name === barName) return tipText('Daily GDD', y.toFixed(1))
      if (name === GDD_NAMES.band) return note ? tipText('Projected range', note) : null
      const label = name === GDD_NAMES.cumulative ? 'Cumulative GDDs' : name === GDD_NAMES.forecast ? 'Projected (forecast)' : 'Projected (normals)'
      return tipText(label, y.toFixed(0), note ? `Growth stage: ${note}` : undefined)
    }),
    series,
  } satisfies EChartsOption
}

export function gddTable(m: GddModel): ChartTable {
  const stages = stageLabels(m)
  const rows = m.series.date.map((d, i) => [d, 'Observed', fmtNum(m.series.daily[i], 1), fmtNum(m.series.cumulative[i], 0), stages[i]])
  const p = m.projection
  if (p) {
    p.date.forEach((d, i) => {
      const basis = p.basis[i] === 'forecast' ? 'Projected (NWS forecast)' : 'Projected (normals median)'
      const st = m.stageMode === 'table' ? stageText(p.stage[i], p.stageName[i]) || '—' : (stages[0] ?? '—')
      rows.push([d, basis, fmtNum(p.daily[i], 1), fmtNum(p.cumulative[i], 0), st])
    })
  }
  return {
    caption: `Growing degree days, ${gddBarName(m.cutoffsF).replace('Daily GDDs ', '')}`,
    columns: ['Date', 'Source', 'Daily GDD (°F)', 'Cumulative GDD (°F)', 'Growth stage'],
    rows,
  }
}
