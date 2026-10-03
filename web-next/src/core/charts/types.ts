/**
 * The chart-builder contract. Every file in core/charts exports builders of
 * type `ChartBuilder`; ui/charts/chart.ts (the one ECharts host) calls them
 * and owns everything stateful (init, theme, resize, dispose, table twin).
 */
import type { EChartsOption } from 'echarts'

/** Resolved colors for the current theme, read from kit tokens + core/palette. */
export interface ChartTheme {
  name: 'dark' | 'light' | 'high-contrast'
  /** Kit chrome tokens, resolved to concrete colors (`getComputedStyle`). */
  text: string
  /** Axis labels and secondary text (`--text-secondary`, ≥ 4.5:1 on every surface). */
  textMuted: string
  /** Axis lines and split lines (`--border`). */
  grid: string
  surface: string
  /** Tooltip fill (`--glass`) and border (`--accent-line`), as the kit's `.mco-tooltip`. */
  tooltipBg: string
  tooltipBorder: string
  /** `--font-ui` / `--font-mono` stacks. */
  fontUi: string
  fontMono: string
  /**
   * Resolved values of the kit tokens that `core/palette` roles reference
   * (`--text-dim`, `--text-primary`, …), for `paint()` in theme.ts.
   */
  vars: Readonly<Record<string, string>>
}

/** What a builder may know about where it renders. */
export interface ChartContext {
  theme: ChartTheme
  /** Container width in CSS px (for label density decisions only). */
  width: number
  /** True under `MCO.viewport.isCompact()`. */
  compact: boolean
  /**
   * True on a touch-first device (`(hover: none) and (pointer: coarse)`): no
   * drag or pinch zoom (a swipe scrolls the page) and tap-triggered tooltips.
   */
  touch: boolean
}

/**
 * A pure builder: model in (core/models or Ag contract series, already in
 * display units), ECharts option out. No DOM, no Alpine, no fetching, no
 * `new Date(string)`. Same input → deep-equal output.
 *
 * Time axes: x values are Denver wall-clock ms (see core/models/timeseries);
 * builders set `useUTC: true` so labels read in Mountain Time.
 */
export type ChartBuilder<M> = (model: M, ctx: ChartContext) => EChartsOption

/**
 * The accessible twin of a chart (HOUSE-STYLE §5.2): the host renders this as
 * an `.sr-only` `<table>` after every render. Builders that support it export
 * a sibling `…Table(model)` function returning this shape.
 */
export interface ChartTable {
  caption: string
  columns: string[]
  /** Cell text, already formatted ("—" for missing). */
  rows: string[][]
}
