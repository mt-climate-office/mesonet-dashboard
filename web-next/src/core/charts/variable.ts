/**
 * The variable page's chart (Charts → `v=`): one variable, drawn by the
 * Compare panel logic (latestTimeseries.ts: lines or bars, soil depths,
 * normals, sensor-change spans, touch modes), with its plot filling the host's
 * height instead of a fixed panel height. The host sets that height in CSS:
 * 420 px, `min(60dvh, 420px)` on phones (styles/charts.css).
 */
import type { EChartsOption } from 'echarts'
import { LAYOUT, latestTimeseriesChart, latestTimeseriesTable, type LatestTimeseriesModel } from './latestTimeseries'
import type { ChartBuilder, ChartTable } from './types'

/** A LatestTimeseriesModel with exactly one panel. */
export type VariableModel = LatestTimeseriesModel

export const variableChart: ChartBuilder<VariableModel> = (m, ctx) => {
  const option = latestTimeseriesChart(m, ctx)
  const [g] = option.grid as { left: number; right: number }[]
  return {
    ...option,
    grid: [{ left: g.left, right: g.right, top: LAYOUT.top, bottom: ctx.compact ? LAYOUT.compactBottom : LAYOUT.bottom }],
  } satisfies EChartsOption
}

/** The sr-only twin (first 500 rows), as Compare's. */
export const variableTable = (m: VariableModel): ChartTable => latestTimeseriesTable(m)

/** Every row, for the visible Table view (paged by core/variables `tablePage`). */
export const variableTableAll = (m: VariableModel): ChartTable => latestTimeseriesTable(m, Infinity)
