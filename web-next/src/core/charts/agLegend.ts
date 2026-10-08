/**
 * The Ag charts' legend: a plain legend that wraps onto more rows, never the
 * paged scroll legend. Series keep their names (fidelity matches traces by
 * them); the legend shows `text`, or `short` on compact screens, where it
 * also drops its title. The builder reserves room for the extra rows with
 * `liftForLegend`.
 */
import type { DataZoomComponentOption, GraphicComponentOption, GridComponentOption, LegendComponentOption } from 'echarts'
import type { ChartContext } from './types'

export interface AgLegendItem {
  /** The series name. */
  name: string
  /** What the legend shows (default: the name). */
  text?: string
  /** What it shows on compact screens (default: `text`). */
  short?: string
  icon?: string
  /** The icon's fill when it is not the series color (e.g. a class ramp as a gradient). */
  color?: LegendFill
}

/** A legend icon fill: a color, or a left-to-right gradient through `stops`. */
export type LegendFill = string | { stops: readonly string[] }

const fill = (c: LegendFill) =>
  typeof c === 'string'
    ? c
    : { type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: c.stops.map((color, i) => ({ offset: i / Math.max(1, c.stops.length - 1), color })) }

/** Height of one more legend row (10 px marks, 11–12 px text, the row gap). */
export const LEGEND_ROW = 22

/** "Extreme Danger" → "Extreme danger". */
export const sentenceCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

/** Estimated text width in px (the UI font averages under 0.6 em a character). */
const textWidth = (s: string, fontSize: number) => Math.ceil(s.length * fontSize * 0.6)

/** Rows a wrapping legend of `widths` takes in `avail` px with `gap` between items. */
export function legendRows(widths: number[], avail: number, gap: number): number {
  let rows = widths.length > 0 ? 1 : 0
  let x = 0
  for (const w of widths) {
    if (x > 0 && x + gap + w > avail) {
      rows++
      x = w
    } else x += (x > 0 ? gap : 0) + w
  }
  return rows
}

/** The legend, its title (desktop only) and the px its rows past the first need. */
export function agLegend(
  ctx: ChartContext,
  items: AgLegendItem[],
  opts: { title?: string } = {},
): { legend: LegendComponentOption; graphic: GraphicComponentOption[]; extra: number } {
  const fontSize = ctx.compact ? 11 : 12
  const itemGap = ctx.compact ? 8 : 10
  const itemWidth = 16
  const textOf = new Map(items.map((i) => [i.name, (ctx.compact ? i.short : undefined) ?? i.text ?? i.name]))
  const title = ctx.compact ? undefined : opts.title
  const titleW = title ? textWidth(title, 12) + 12 : 0
  // ECharts pads the legend 5 px a side; keep 8 px clear of the card edge.
  const avail = ctx.width - 16 - titleW - 10
  const widths = items.map((i) => itemWidth + 5 + textWidth(textOf.get(i.name) ?? i.name, fontSize))
  const rows = legendRows(widths, avail, itemGap)
  const legend: LegendComponentOption = {
    type: 'plain',
    bottom: 4,
    data: items.map((i) =>
      i.icon || i.color ? { name: i.name, ...(i.icon ? { icon: i.icon } : {}), ...(i.color ? { itemStyle: { color: fill(i.color) } } : {}) } : i.name,
    ),
    itemWidth,
    itemHeight: 10,
    itemGap,
    textStyle: { fontSize },
    formatter: (n: string) => textOf.get(n) ?? n,
    ...(title ? { left: 8 + titleW, right: 8 } : { left: 'center' }),
  }
  const extra = Math.max(0, rows - 1) * LEGEND_ROW
  // The title sits beside the legend's first (top) row.
  const graphic: GraphicComponentOption[] = title
    ? [{ type: 'text', left: 8, bottom: 7 + extra, silent: true, style: { text: title, fill: ctx.theme.text, font: `600 12px ${ctx.theme.fontUi}` } }]
    : []
  return { legend, graphic, extra }
}

/** Raise the plot (grid bottom) and the zoom slider by `extra` px for a wrapped legend. */
export function liftForLegend(
  grid: GridComponentOption,
  zoom: DataZoomComponentOption[],
  extra: number,
): { grid: GridComponentOption; dataZoom: DataZoomComponentOption[] } {
  if (extra === 0) return { grid, dataZoom: zoom }
  return {
    grid: { ...grid, bottom: Number(grid.bottom ?? 0) + extra },
    dataZoom: zoom.map((z) => (z.type === 'slider' ? { ...z, bottom: Number((z as { bottom?: number }).bottom ?? 0) + extra } : z)),
  }
}
