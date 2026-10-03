/**
 * Growing degree days: daily bars (y1) + cumulative line (y2) with labelled
 * growth-stage markLines, and an optional projection (NWS forecast segment,
 * then normals median with a q25–q75 band) continuing from the last
 * observed day. GDD values are already °F·day (contract), so no conversion.
 */
import type { EChartsOption, LineSeriesOption } from 'echarts'
import type { GddProjection, GddSeries, GddStage, Nullable } from '../ag/contract'
import { finiteMax, stageText } from '../ag/view/labels'
import { GDD, GDD_STAGE_LINE, withAlpha } from '../palette'
import { dualAxis, grid, niceCeil, timeAxis, timeZoom } from './axes'
import { fmtNum, fmtWall, wallMs } from './format'
import { bandSeries, labelledLines } from './overlays'
import { barSeries, lineSeries, points } from './series'
import { paint } from './theme'
import { axisTooltip, legend, tipText } from './tooltip'
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
      [...start.x.map(() => ''), ...ix.map((i) => stage[i])],
    )
  const out: LineSeriesOption[] = []
  if (nm.length > 0) {
    out.push(
      ...bandSeries(GDD_NAMES.band, GDD_NAMES.q25, [...ax, ...px], [...ay, ...p.cumulativeQ25], [...ay, ...p.cumulativeQ75], {
        color: colors.band,
        yAxisIndex: 1,
        stack: 'gdd-proj',
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
  const cumulative = lineSeries(GDD_NAMES.cumulative, points(xs, m.series.cumulative, stages), {
    color: c.cumulative,
    yAxisIndex: 1,
  })
  const lines = stageLines(m.stageMode === 'table' ? (m.stages ?? []) : [], y2max)
  if (lines.length > 0) cumulative.markLine = labelledLines(paint(ctx.theme, GDD_STAGE_LINE), lines, ctx)
  const proj =
    m.projection && m.projection.date.length > 0
      ? projectionSeries(m, m.projection, { line: c.cumulative, band: withAlpha(c.cumulative, c.bandAlpha) })
      : []
  const barName = gddBarName(m.cutoffsF)
  return {
    useUTC: true,
    grid: grid(ctx, { right: 64 }),
    xAxis: timeAxis(),
    yAxis: dualAxis('Daily GDD (°F)', 'Cumulative GDD (°F)', { rightMax: y2max }),
    dataZoom: timeZoom(ctx),
    legend: legend(ctx, {
      data: [
        barName,
        GDD_NAMES.cumulative,
        ...proj.flatMap((s): (string | { name: string; icon: string })[] =>
          s.name === GDD_NAMES.q25 ? [] : s.name === GDD_NAMES.band ? [{ name: GDD_NAMES.band, icon: 'rect' }] : [String(s.name)],
        ),
      ],
    }).legend,
    tooltip: axisTooltip(ctx, (x) => fmtWall(x, 'daily'), (name, y, note) => {
      if (name === barName) return tipText('Daily GDD', y.toFixed(1))
      if (name === GDD_NAMES.band) return note ? tipText('Projected range', note) : null
      const label = name === GDD_NAMES.cumulative ? 'Cumulative GDDs' : name === GDD_NAMES.forecast ? 'Projected (forecast)' : 'Projected (normals)'
      return tipText(label, y.toFixed(0), note ? `Growth stage: ${note}` : undefined)
    }),
    series: [barSeries(barName, points(xs, m.series.daily), c.bar), cumulative, ...proj],
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
