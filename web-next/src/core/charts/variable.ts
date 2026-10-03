/**
 * The variable page's chart (Charts → `v=`): one variable, drawn by the
 * Compare panel logic (latestTimeseries.ts: lines or bars, soil depths,
 * normals, sensor-change spans, touch modes), with its plot filling the host's
 * height instead of a fixed panel height. On the Daily interval a one-column
 * variable also gets its daily low–high band (core/variables/band) behind the
 * mean line, named in the tooltip. The host sets the height in CSS: 420 px,
 * `min(60dvh, 420px)` on phones (styles/charts.css).
 */
import type { EChartsOption, SeriesOption } from 'echarts'
import { DAILY_RANGE, withAlpha } from '../palette'
import { plainUnit } from '../variables/labels'
import { LAYOUT, latestTimeseriesChart, latestTimeseriesTable, seriesColor, type LatestTimeseriesModel } from './latestTimeseries'
import { bandSeries } from './overlays'
import { AUX } from './series'
import { tipText, type TipParam } from './tooltip'
import type { ChartBuilder, ChartTable } from './types'

/** A LatestTimeseriesModel with exactly one panel. */
export type VariableModel = LatestTimeseriesModel

const BAND_ID = 'daily-range'

export const variableChart: ChartBuilder<VariableModel> = (m, ctx) => {
  const option = latestTimeseriesChart(m, ctx)
  const [g] = option.grid as { left: number; right: number }[]
  const panel = m.ts.panels[0]
  const s = panel?.series.length === 1 ? panel.series[0] : undefined
  const out: EChartsOption = {
    ...option,
    grid: [{ left: g.left, right: g.right, top: LAYOUT.top, bottom: ctx.compact ? LAYOUT.compactBottom : LAYOUT.bottom }],
  }
  if (!s?.band) return out

  // Appended (the base tooltip reads series by index), drawn behind the line (z).
  const ok = m.ts.x.map(Number.isFinite)
  const pick = <T>(a: readonly T[]) => a.filter((_, j) => ok[j])
  // Daily rows sit at local noon, as latestTimeseries draws them.
  const xs = pick(m.ts.x).map((x) => x + 12 * 3_600_000)
  const color = withAlpha(seriesColor(ctx, panel, s, 0), DAILY_RANGE.alpha)
  const band = bandSeries(DAILY_RANGE.label, `${AUX}${BAND_ID}-base`, xs, pick(s.band.lo), pick(s.band.hi), { color, digits: 1, stack: BAND_ID })
  const unit = plainUnit(/\[([^\]]+)\]\s*$/.exec(s.name)?.[1] ?? '')
  const base = (option.tooltip as { formatter: (p: TipParam | TipParam[]) => string }).formatter
  const formatter = (raw: TipParam | TipParam[]) => {
    const fill = (Array.isArray(raw) ? raw : [raw]).find((p) => p.seriesId === `${BAND_ID}-band`)
    const note = Array.isArray(fill?.value) && typeof fill.value[2] === 'string' ? fill.value[2] : ''
    return base(raw) + (note ? `<div>${tipText('Low–high', `${note}${unit ? ` ${unit}` : ''}`)}</div>` : '')
  }
  return {
    ...out,
    tooltip: { ...(option.tooltip as object), formatter: formatter as never },
    series: [...(option.series as SeriesOption[]), ...band.map((b) => ({ ...b, z: 1 }))],
  }
}

/** The sr-only twin (first 500 rows), as Compare's; daily low and high columns with a band. */
export const variableTable = (m: VariableModel): ChartTable => latestTimeseriesTable(m)

/** Every row, for the visible table view (paged by core/variables `tablePage`). */
export const variableTableAll = (m: VariableModel): ChartTable => latestTimeseriesTable(m, Infinity)
