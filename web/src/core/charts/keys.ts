/**
 * The charts' key: rows of swatches (a line, a block or a glyph) with muted labels, drawn as
 * graphics left-aligned at the top left of the plot. Station charts (latestTimeseries, variable)
 * and the years charts (agAnnual: All years, Ag Annual) share it, so every key reads the same.
 */
import type { GraphicComponentOption } from 'echarts'
import type { ChartContext } from './types'

export interface KeyEntry {
  label: string
  color: string
  dash?: 'dashed' | 'dotted'
  /** Text glyph instead of a line swatch (normals markers, wind-direction dots). */
  glyph?: string
  /** Filled block (sensor change, normals band). */
  block?: boolean
  /** The one emphasized entry (the current year): a heavier swatch, the label in text color and bold. */
  strong?: boolean
}

/** Space between two keys in a row (px). */
export const KEY_GAP = 12

/** Height of one key row (px), for keys that wrap. */
export const KEY_ROW = 16

/** One key's width in px: its swatch, 4 px, and its text (estimated from the label's length; bold runs wider). */
export function keyWidth(ctx: ChartContext, e: KeyEntry): number {
  const per = (ctx.compact ? 5.6 : 6.2) * (e.strong ? 1.1 : 1)
  return (e.glyph ? 10 : 14) + 4 + Math.ceil(e.label.length * per)
}

/** A row's width in px. */
export const rowWidth = (ctx: ChartContext, entries: KeyEntry[]): number => entries.reduce((w, e, i) => w + keyWidth(ctx, e) + (i ? KEY_GAP : 0), 0)

/** `entries` wrapped into rows no wider than `avail` px, in order. */
export function wrapKeys(ctx: ChartContext, entries: KeyEntry[], avail: number): KeyEntry[][] {
  const rows: KeyEntry[][] = []
  for (const e of entries) {
    const row = rows[rows.length - 1]
    if (row && rowWidth(ctx, [...row, e]) <= avail) row.push(e)
    else rows.push([e])
  }
  return rows
}

/** A row of keys, left-aligned from `left` px with its middle at `y`. */
export function keyRow(ctx: ChartContext, entries: KeyEntry[], left: number, y: number): GraphicComponentOption[] {
  const size = ctx.compact ? 10 : 11
  let x = left
  const out: GraphicComponentOption[] = []
  for (const e of entries) {
    const font = `${e.strong ? '600 ' : ''}${size}px ${ctx.theme.fontUi}`
    const swatchW = e.glyph ? 10 : 14
    const swatch = e.glyph
      ? { type: 'text' as const, x: 0, y: 0, style: { text: e.glyph, fill: e.color, font, verticalAlign: 'middle' as const } }
      : e.block
        ? { type: 'rect' as const, shape: { x: 0, y: -5, width: 12, height: 10 }, style: { fill: e.color, stroke: ctx.theme.textMuted, lineWidth: 1 } }
        : {
            type: 'line' as const,
            shape: { x1: 0, y1: 0, x2: 14, y2: 0 },
            style: { stroke: e.color, lineWidth: e.strong ? 3 : 2, lineDash: e.dash === 'dashed' ? [5, 3] : e.dash === 'dotted' ? [1.5, 2.5] : undefined },
          }
    out.push({
      type: 'group',
      x,
      y,
      silent: true,
      children: [swatch, { type: 'text', x: swatchW + 4, y: 0, style: { text: e.label, fill: e.strong ? ctx.theme.text : ctx.theme.textMuted, font, verticalAlign: 'middle' } }],
    } as GraphicComponentOption)
    x += keyWidth(ctx, e) + KEY_GAP
  }
  return out
}
