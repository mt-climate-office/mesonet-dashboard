/**
 * Growing degree days: daily bars (y1) + cumulative line (y2) with labelled
 * growth-stage markLines, and an optional projection (NWS forecast segment,
 * then normals median with a q25–q75 band) continuing from the last
 * observed day. With a stage table, the bars are colored by the growth stage
 * reached that day (a hidden piecewise visualMap on x); the stage lines are one
 * neutral stroke above the bars, and the cumulative line and the projection stay
 * in the text color on a surface-colored halo, so none vanish into the bars.
 * GDD values are already °F·day (contract), so no conversion.
 */
import type { EChartsOption, LineSeriesOption, VisualMapComponentOption } from 'echarts'
import type { GddProjection, GddSeries, GddStage, Nullable } from '../ag/contract'
import { finiteMax, stageText } from '../ag/view/labels'
import { CUMULATIVE_LINE, GDD, GDD_STAGE_LINE, gddStageColors } from '../palette'
import { dualAxis, niceCeil } from './axes'
import { fmtNum, fmtWall, wallMs } from './format'
import { bandSeries, labelledLines } from './overlays'
import { AUX, barSeries, lineSeries } from './series'
import { DAY, LEGEND_PX, LINE_WIDTH, plotExtent, points, timeFrame } from './style'
import { paint } from './theme'
import { agLegend, liftForLegend } from './agLegend'
import { axisTooltip, tipText } from './tooltip'
import type { ChartBuilder, ChartTable } from './types'

export interface GddModel {
  series: GddSeries
  /** Display cutoffs (°F) for the bar name; Infinity = no upper cap. */
  cutoffsF: readonly [number, number]
  /** The upper cutoff (°F) after the NDAWN switch at Haun stage 2 (wheat, barley), when it applies. */
  switchHighF?: number
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
 * a quarter of the chart: the lines then go unlabelled and the tooltip,
 * table and stats card name the stage.
 */
export function stageGutter(lines: { label: string }[], width: number): number {
  if (lines.length === 0) return 0
  const w = Math.ceil(Math.max(...lines.map((l) => l.label.length)) * STAGE_FONT * 0.5) + 12
  return w <= width / 4 ? w : 0
}

/**
 * The stage labels that fit beside the plot: the full ones ("3 – Leaf 3 …"), else the stage codes
 * alone ("3"; phones, tablets: the tooltip names the stage), else none (gutter 0).
 */
export function fittedStageLabels(lines: StageLine[], width: number): { lines: { y: number; label: string }[]; gutter: number } {
  for (const key of ['label', 'short'] as const) {
    const fitted = lines.map((l) => ({ y: l.y, label: l[key] }))
    const gutter = stageGutter(fitted, width)
    if (gutter > 0) return { lines: fitted, gutter }
  }
  return { lines: lines.map((l) => ({ y: l.y, label: l.label })), gutter: 0 }
}

const fmtF = (f: number) => (Number.isFinite(f) ? `${f}` : '∞')

/** "Daily GDDs (32–∞ °F)", or "Daily GDDs (32–70/95 °F)" with the NDAWN switch's second upper cutoff. */
export const gddBarName = (cutoffsF: readonly [number, number], switchHighF?: number) =>
  `Daily GDDs (${fmtF(cutoffsF[0])}–${fmtF(cutoffsF[1])}${switchHighF != null ? `/${fmtF(switchHighF)}` : ''} °F)`

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

export interface StageLine {
  y: number
  /** "3 – Leaf 3 (Tillers Begin To Emerge)". */
  label: string
  /** The stage code alone ("3", "V1", "12-14") for narrow charts. */
  short: string
}

/** "V1 (Emergence)" → "V1", "BBCH Stages 12-14" → "12-14", "0.5" → "0.5". */
const shortStage = (code: string) => code.replace(/\s*\(.*\)$/, '').replace(/^BBCH Stages? /, '')

/**
 * Stage lines within (0, y2max], thinned so labels never stack: the highest stage drawn and the
 * stage `reached` (cumulative GDDs so far) always stay; any other stage closer than y2max / 16 to
 * one kept is skipped (its name still shows in the tooltip and table).
 */
export function stageLines(stages: GddStage[], y2max: number, reached?: Nullable): StageLine[] {
  const inRange = [...stages].sort((a, b) => a.gdd - b.gdd).filter((s) => s.gdd > 0 && s.gdd <= y2max)
  if (inRange.length === 0) return []
  const reachedIx = reached == null ? -1 : inRange.filter((s) => s.gdd <= reached).length - 1
  const pinned = new Set([inRange[inRange.length - 1], ...(reachedIx >= 0 ? [inRange[reachedIx]] : [])])
  const gap = y2max / 16
  const kept = [...pinned]
  for (const s of inRange) if (!pinned.has(s) && kept.every((k) => Math.abs(k.gdd - s.gdd) >= gap)) kept.push(s)
  return kept
    .sort((a, b) => a.gdd - b.gdd)
    .map((s) => ({ y: s.gdd, label: stageText(s.code ?? s.stage, s.name), short: shortStage(String(s.code ?? s.stage)) }))
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

/** A line's halo: the same points, wider, in `color` (the surface), drawn under it; a drawing aid (AUX). */
export function halo(line: LineSeriesOption, color: string): LineSeriesOption {
  return {
    type: 'line',
    id: `${AUX}halo-${String(line.id ?? line.name)}`,
    name: `${AUX}halo`,
    data: line.data,
    yAxisIndex: line.yAxisIndex,
    smooth: false,
    showSymbol: false,
    connectNulls: false,
    silent: true,
    lineStyle: { color, width: (line.lineStyle?.width ?? LINE_WIDTH) + 3, type: 'solid' },
    emphasis: { disabled: true },
    sampling: line.sampling,
  }
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
  // One color per stage (index 0: before the first); the bars take the stage reached so far,
  // so the legend shows the current one.
  const stageColors = table.length > 0 ? gddStageColors(table.length + 1, ctx.theme.name) : []
  const soFar = m.series.cumulative[lastIndex(m.series.cumulative)] ?? null
  const nowStage = stageIndex(table, soFar) ?? 0
  const barColor = stageColors[nowStage] ?? c.bar
  const lineColor = paint(ctx.theme, CUMULATIVE_LINE)
  const cumPoints = points(xs, m.series.cumulative, DAY, stages)
  const cumulative = lineSeries(GDD_NAMES.cumulative, cumPoints, {
    color: lineColor,
    yAxisIndex: 1,
  })
  const { lines, gutter } = fittedStageLabels(stageLines(table, y2max, soFar), ctx.width)
  if (lines.length > 0) {
    // One neutral stroke, above the bars: a stage-colored line vanished across bars of its own stage.
    cumulative.markLine = { ...labelledLines(paint(ctx.theme, GDD_STAGE_LINE), lines, ctx, { labels: gutter > 0, fontSize: STAGE_FONT }), z: 4 }
  }
  const proj =
    m.projection && m.projection.date.length > 0
      ? projectionSeries(m, m.projection, { line: lineColor, band: paint(ctx.theme, { ...CUMULATIVE_LINE, alpha: c.bandAlpha }) })
      : []
  const barName = gddBarName(m.cutoffsF, m.switchHighF)
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
  // Each cumulative and projected line rides on a wider surface-colored halo, so it reads over the
  // pale late-stage bars in every theme.
  const lined = [cumulative, ...proj].flatMap((s) => (s.lineStyle?.opacity === 0 ? [s] : [halo(s, ctx.theme.surface), s]))
  // The stage lines get a solid surface-colored underlay too (on the cumulative halo, drawn first),
  // so the dashed stroke reads across bars of any stage color.
  if (lines.length > 0) {
    lined[0] = { ...lined[0], markLine: { silent: true, symbol: 'none', z: 3, label: { show: false }, lineStyle: { color: ctx.theme.surface, width: 3, type: 'solid' }, data: lines.map((l) => ({ yAxis: l.y })) } }
  }
  const series = [...(f.trace ? [f.trace.series] : []), barSeries(barName, points(xs, m.series.daily, DAY), barColor), ...lined]
  let visualMap: VisualMapComponentOption | undefined
  if (stageColors.length > 0) {
    visualMap = {
      type: 'piecewise',
      show: false,
      dimension: 0,
      seriesIndex: [series.findIndex((s) => s.name === barName)],
      pieces: stagePieces(m.series.date, m.series.cumulative, table, stageColors),
      outOfRange: { color: barColor },
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
    caption: `Growing degree days, ${gddBarName(m.cutoffsF, m.switchHighF).replace('Daily GDDs ', '')}`,
    columns: ['Date', 'Source', 'Daily GDD (°F)', 'Cumulative GDD (°F)', 'Growth stage'],
    rows,
  }
}
