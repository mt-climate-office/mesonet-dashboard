/**
 * Growing degree day figure: daily GDD bars + cumulative line on y2 with
 * markers colored by growth stage (vendored stage tables via `gdd()`), plus
 * an optional projection overlay from `projectGdd()` (NWS forecast days,
 * then the 1991–2020 normals median with a q25–q75 band).
 */
import type { Data, Layout } from 'plotly.js'
import { GDD_STAGE_COLORS } from '../../../lib/params/palettes'
import type { GddProjection, GddSeries } from '../contract'
import { type Figure, baseLayout, finiteMax, insertGapsColumnar } from './common'

export interface GddFigureOptions {
  /** Display cutoffs (°F) for the bar label, e.g. [32, 70]. */
  cutoffsF: readonly [number, number]
  /** Stage-label mode: crop with a table, crop without one, or custom cutoffs. */
  stageMode: 'table' | 'no-table' | 'custom'
  /** Crop display name, for the "no stage table" hover. */
  cropLabel?: string
  projection?: GddProjection
}

const fmtF = (f: number) => (Number.isFinite(f) ? `${f}` : '∞')

/** "V1 (Emergence)", or "2 – Two leaves" when the stage id and name differ. */
export function stageText(stage: number | string | null, name: string | null): string {
  if (stage == null) return ''
  const s = String(stage)
  if (name && !s.includes(name)) return s === '0' ? name : `${s} – ${name}`
  return s === '0' && !name ? 'Before first stage' : s
}

const BAR_COLOR = '#DDCC77' // Tol-Muted "sand"
const LINE_COLOR = '#332288' // Tol-Muted "indigo"

export function gddFigure(series: GddSeries, opts: GddFigureOptions): Figure {
  const x = series.date
  const hoverStage = (i: number): string => {
    if (opts.stageMode === 'custom') return 'n/a (custom cutoffs)'
    if (opts.stageMode === 'no-table') return `No stage table for ${opts.cropLabel ?? 'this crop'}`
    return stageText(series.stage[i], series.stageName[i]) || '—'
  }
  const stageLabels = x.map((_, i) => hoverStage(i))
  const stageOrder = opts.stageMode === 'table' ? [...new Set(stageLabels)] : []
  const stageColor = new Map(stageOrder.map((s, i) => [s, GDD_STAGE_COLORS[i % GDD_STAGE_COLORS.length]]))

  const epoch = x.map((d) => Date.parse(`${d}T12:00Z`))
  const line = insertGapsColumnar(epoch, x, [series.cumulative])

  const [lo, hi] = opts.cutoffsF
  const traces: Data[] = [
    {
      type: 'bar',
      x,
      y: series.daily,
      name: `Daily GDDs (${fmtF(lo)}–${fmtF(hi)} °F)`,
      marker: { color: BAR_COLOR },
      hovertemplate: '<b>Date</b>: %{x|%b %d, %Y}<br><b>Daily GDDs</b>: %{y:.1f}<extra></extra>',
    } as Data,
    {
      type: 'scatter',
      mode: 'lines+markers',
      x: line.x,
      y: line.ys[0],
      yaxis: 'y2',
      name: 'Cumulative GDDs',
      connectgaps: false,
      line: { color: LINE_COLOR, width: 2 },
      marker: {
        color: stageOrder.length > 0 ? stageLabels.map((s) => stageColor.get(s) ?? '#888') : LINE_COLOR,
        size: 7,
      },
      customdata: stageLabels as unknown as number[],
      hovertemplate:
        '<b>Date</b>: %{x|%b %d, %Y}<br><b>Cumulative GDDs</b>: %{y:.0f}<br><b>Growth Stage</b>: %{customdata}<extra></extra>',
    } as Data,
  ]

  let cumMax = finiteMax(series.cumulative)
  const p = opts.projection
  if (p && p.date.length > 0) {
    cumMax = Math.max(cumMax, finiteMax(p.cumulativeQ75), finiteMax(p.cumulative))
    // Anchor every projection trace on the last observed point so the
    // overlay visibly continues the observed line.
    let anchor = -1
    for (let i = series.cumulative.length - 1; i >= 0; i--) {
      if (series.cumulative[i] != null) {
        anchor = i
        break
      }
    }
    const ax = anchor >= 0 ? [series.date[anchor]] : []
    const ay = anchor >= 0 ? [series.cumulative[anchor]] : []
    const pStage = p.date.map((_, i) =>
      opts.stageMode === 'table' ? stageText(p.stage[i], p.stageName[i]) || '—' : hoverStage(0),
    )
    const normalsIx = p.basis.flatMap((b, i) => (b === 'normals' ? [i] : []))
    if (normalsIx.length > 0) {
      traces.push(
        {
          type: 'scatter',
          mode: 'lines',
          x: [...ax, ...p.date],
          y: [...ay, ...p.cumulativeQ25],
          yaxis: 'y2',
          line: { width: 0, color: 'rgba(0,0,0,0)' },
          hoverinfo: 'skip',
          showlegend: false,
          name: 'Projected 25th percentile',
        } as Data,
        {
          type: 'scatter',
          mode: 'lines',
          x: [...ax, ...p.date],
          y: [...ay, ...p.cumulativeQ75],
          yaxis: 'y2',
          fill: 'tonexty',
          fillcolor: 'rgba(51, 34, 136, 0.15)',
          line: { width: 0, color: 'rgba(0,0,0,0)' },
          name: 'Projected range (normals 25th–75th pct.)',
          customdata: [...ay, ...p.cumulativeQ25] as unknown as number[],
          hovertemplate:
            '<b>Date</b>: %{x|%b %d, %Y}<br><b>Projected range</b>: %{customdata:.0f}–%{y:.0f}<extra></extra>',
        } as Data,
      )
    }
    const fcIx = p.basis.flatMap((b, i) => (b === 'forecast' ? [i] : []))
    const seg = (ix: number[], start: { x: string[]; y: (number | null)[] }) => ({
      x: [...start.x, ...ix.map((i) => p.date[i])],
      y: [...start.y, ...ix.map((i) => p.cumulative[i])],
      customdata: [...start.y.map(() => ''), ...ix.map((i) => pStage[i])],
    })
    if (fcIx.length > 0) {
      const s = seg(fcIx, { x: ax, y: ay })
      traces.push({
        type: 'scatter',
        mode: 'lines',
        ...s,
        customdata: s.customdata as unknown as number[],
        yaxis: 'y2',
        name: 'Projected (NWS forecast)',
        line: { color: LINE_COLOR, width: 2, dash: 'dot' },
        hovertemplate:
          '<b>Date</b>: %{x|%b %d, %Y}<br><b>Projected GDDs (forecast)</b>: %{y:.0f}<br><b>Growth Stage</b>: %{customdata}<extra></extra>',
      } as Data)
    }
    if (normalsIx.length > 0) {
      // Continue from the last forecast day (or the observed anchor).
      const lastFc = fcIx.length > 0 ? fcIx[fcIx.length - 1] : -1
      const start =
        lastFc >= 0 ? { x: [p.date[lastFc]], y: [p.cumulative[lastFc]] } : { x: ax, y: ay }
      const s = seg(normalsIx, start)
      traces.push({
        type: 'scatter',
        mode: 'lines',
        ...s,
        customdata: s.customdata as unknown as number[],
        yaxis: 'y2',
        name: 'Projected (normals median)',
        line: { color: LINE_COLOR, width: 2, dash: 'dash' },
        hovertemplate:
          '<b>Date</b>: %{x|%b %d, %Y}<br><b>Projected GDDs (normals)</b>: %{y:.0f}<br><b>Growth Stage</b>: %{customdata}<extra></extra>',
      } as Data)
    }
  }

  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'h', y: -0.2 },
    yaxis: {
      title: { text: '<b>Daily GDDs [GDD °F]</b>' },
      side: 'left',
      range: [0, finiteMax(series.daily) || 1],
    },
    yaxis2: {
      title: { text: '<b>Cumulative GDDs [GDD °F]</b>' },
      side: 'right',
      overlaying: 'y',
      range: [0, cumMax * 1.02 || 1],
    },
    xaxis: { type: 'date', showspikes: true, spikemode: 'toaxis+across', spikesnap: 'cursor' },
  }
  return { data: traces, layout }
}
