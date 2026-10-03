/**
 * Line / bar / marker series in the house chart style (style.ts): one line width, no smoothing,
 * no symbols on lines, LTTB on long lines, nulls (gaps, from style `points`) break lines; bars for
 * every accumulation at every interval. Colors are passed in from core/palette.
 */
import type { BarSeriesOption, LineSeriesOption, ScatterSeriesOption } from 'echarts'
import { LINE_WIDTH, type Point } from './style'

/** Line series longer than this get `sampling: 'lttb'` (LTTB keeps the gap nulls, so breaks survive). */
export const LTTB_THRESHOLD = 2000

/** Series ids with this prefix are drawing aids: the tooltip and table skip them. */
export const AUX = 'aux:'

/** A data line: `LINE_WIDTH` unless given, straight segments, no symbols, gaps kept, LTTB when long. */
export function lineSeries(
  name: string,
  data: Point[],
  style: { color: string; width?: number; dash?: 'dashed' | 'dotted'; yAxisIndex?: number; id?: string },
): LineSeriesOption {
  return {
    type: 'line',
    id: style.id,
    name,
    data,
    yAxisIndex: style.yAxisIndex ?? 0,
    smooth: false,
    showSymbol: false,
    symbol: 'circle',
    connectNulls: false,
    color: style.color,
    lineStyle: { color: style.color, width: style.width ?? LINE_WIDTH, type: style.dash ?? 'solid' },
    emphasis: { focus: 'none', lineStyle: { width: style.width ?? LINE_WIDTH } },
    sampling: data.length > LTTB_THRESHOLD ? 'lttb' : undefined,
  }
}

/**
 * An accumulation's bars (one per interval, at every interval) on a time axis: `barMaxWidth` keeps a
 * short window from drawing slabs, `barMinWidth` keeps 5-min bars over a week from vanishing.
 */
export function barSeries(name: string, data: Point[], color: string, yAxisIndex = 0): BarSeriesOption {
  return { type: 'bar', name, data, yAxisIndex, color, itemStyle: { color }, barMaxWidth: 18, barMinWidth: 1, barCategoryGap: '20%' }
}

/** Marker-only series (regime / class markers). Null points are dropped. */
export function markerSeries(
  name: string,
  data: Point[],
  style: { color: string; symbol?: string; size?: number },
): ScatterSeriesOption {
  return {
    type: 'scatter',
    name,
    data: data.filter((p) => p[1] != null),
    color: style.color,
    itemStyle: { color: style.color },
    symbol: style.symbol ?? 'circle',
    symbolSize: style.size ?? 6,
  }
}
