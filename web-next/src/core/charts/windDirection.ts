/**
 * How a time chart draws wind direction (latestTimeseries, agAnnual): compass ticks on its fixed
 * 0–360° axis, and small dots rather than a line (a line through bearings that wrap through north
 * reads as noise). The circular rules themselves are core/variables/direction.
 */
import type { ScatterSeriesOption } from 'echarts'
import { markerSeries } from './series'
import type { Point } from './style'

const COMPASS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N' }

/** A wind-direction y tick: N, E, S, W, N at 0–360°; any other value in degrees ("45°"). */
export const compassTick = (deg: number): string => COMPASS[deg] ?? `${deg}°`

/** Dot diameter (px) of a wind-direction reading. */
export const DIRECTION_DOT = 3

/** Marker shapes (and their key glyphs) that tell several sensors' dots apart, as dashes do lines. */
export const DIRECTION_SHAPES = [
  { symbol: 'circle', glyph: '●' },
  { symbol: 'triangle', glyph: '▲' },
  { symbol: 'rect', glyph: '■' },
] as const

/** Bearings (°) as small dots in `color`; nulls (gaps) are dropped. `size` defaults to DIRECTION_DOT. */
export function directionDots(
  name: string,
  data: Point[],
  style: { color: string; size?: number; symbol?: string; id?: string; yAxisIndex?: number },
): ScatterSeriesOption {
  return {
    ...markerSeries(name, data, { color: style.color, size: style.size ?? DIRECTION_DOT, symbol: style.symbol }),
    ...(style.id ? { id: style.id } : {}),
    yAxisIndex: style.yAxisIndex ?? 0,
  }
}
