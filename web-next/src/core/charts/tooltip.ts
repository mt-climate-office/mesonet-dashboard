/**
 * Tooltip and legend defaults. The tooltip is the kit's `.mco-tooltip`
 * (class + token colors from theme.ts); its HTML can use kit CSS variables.
 * Drawing-aid series (id prefix `aux:`) never appear in tooltips or legends.
 */
import type { GraphicComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts'
import { AUX } from './series'
import { escapeHtml } from './format'
import type { ChartContext } from './types'

/** What the formatter receives per hovered series (a subset of ECharts' callback params). */
export interface TipParam {
  seriesId?: string
  seriesName?: string
  marker?: unknown
  value?: unknown
  axisValue?: unknown
}

/** One tooltip row's value text for a series; null hides the row. */
export type TipRow = (seriesName: string, y: number, note: string | undefined) => string | null

const isAux = (p: TipParam) => String(p.seriesId ?? '').startsWith(AUX)

/** Shared tooltip chrome: kit class, token colors, kept inside the chart. */
export function tooltipBase(ctx: ChartContext): TooltipComponentOption {
  return {
    // Not `.visible`: ECharts creates the element empty, and the kit hides .mco-tooltip until visible.
    className: 'mco-tooltip',
    confine: true,
    // ECharts paints the hovered series' color as the border; the kit border wins here.
    extraCssText: `opacity:1;border-color:${ctx.theme.tooltipBorder};white-space:normal;max-width:20rem;`,
  }
}

/**
 * Axis tooltip: a header from the x value, then one row per hovered series
 * with a finite y. Points may carry a note as `value[2]` (e.g. a growth stage).
 */
export function axisTooltip(ctx: ChartContext, header: (x: number) => string, row: TipRow): TooltipComponentOption {
  return {
    ...tooltipBase(ctx),
    trigger: 'axis',
    axisPointer: { type: 'line' },
    formatter: ((raw: TipParam | TipParam[]) => {
      const list = Array.isArray(raw) ? raw : [raw]
      if (list.length === 0) return ''
      const lines: string[] = []
      for (const p of list) {
        if (isAux(p) || !Array.isArray(p.value)) continue
        const y = p.value[1]
        if (typeof y !== 'number' || !Number.isFinite(y)) continue
        const text = row(p.seriesName ?? '', y, typeof p.value[2] === 'string' ? p.value[2] : undefined)
        if (text != null) lines.push(`<div>${typeof p.marker === 'string' ? p.marker : ''}${text}</div>`)
      }
      const x = Number(list[0].axisValue ?? (Array.isArray(list[0].value) ? list[0].value[0] : NaN))
      return `<div class="tooltip-name">${escapeHtml(header(x))}</div>${lines.join('')}`
    }) as TooltipComponentOption['formatter'],
  }
}

/** "Name: <mono>value unit</mono>" for a tooltip row (escaped). */
export function tipText(name: string, value: string, note?: string): string {
  const v = `<span style="font-family:var(--font-mono)">${escapeHtml(value)}</span>`
  return `${escapeHtml(name)}: ${v}${note ? `<br><span style="color:var(--text-muted)">${escapeHtml(note)}</span>` : ''}`
}

/**
 * Bottom scroll legend. With `title`, a text label sits at the legend's left
 * (ECharts legends have no title); its width is estimated from the text.
 */
export function legend(
  ctx: ChartContext,
  opts: { data?: (string | { name: string; icon?: string })[]; title?: string } = {},
): { legend: LegendComponentOption; graphic: GraphicComponentOption[] } {
  const titleW = opts.title ? Math.ceil(opts.title.length * 6.6) + 12 : 0
  const base: LegendComponentOption = {
    type: 'scroll',
    bottom: 4,
    data: opts.data,
    itemWidth: 16,
    itemHeight: 10,
    textStyle: { fontSize: ctx.compact ? 11 : 12 },
  }
  if (!opts.title) return { legend: { ...base, left: 'center' }, graphic: [] }
  return {
    legend: { ...base, left: 8 + titleW, right: 8 },
    graphic: [
      {
        type: 'text',
        left: 8,
        bottom: 7,
        silent: true,
        style: { text: opts.title, fill: ctx.theme.text, font: `600 12px ${ctx.theme.fontUi}` },
      },
    ],
  }
}
