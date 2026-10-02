/**
 * Kit tokens → `ChartTheme` → ECharts theme object. Pure: the chart host
 * passes a `getVar` that reads `getComputedStyle(document.documentElement)`;
 * tests pass a fake. Builders use `paint()` to turn palette roles into colors.
 */
import { resolve, withAlpha, type ColorOrToken, type Theme } from '../palette'
import type { ChartTheme } from './types'

/** ChartTheme field → kit token it is read from. */
export const THEME_TOKENS = {
  text: '--text-primary',
  textMuted: '--text-secondary',
  grid: '--border',
  surface: '--bg-surface',
  tooltipBg: '--glass',
  tooltipBorder: '--accent-line',
  fontUi: '--font-ui',
  fontMono: '--font-mono',
} as const satisfies Record<string, string>

/** Tokens referenced by core/palette roles (TokenRef), resolved into `ChartTheme.vars`. */
export const PALETTE_VARS = ['--text-dim', '--text-primary', '--selection-ring'] as const

/** Read every token a chart needs. Missing tokens become '' (ECharts then uses its default). */
export function readChartTheme(name: Theme, getVar: (token: string) => string): ChartTheme {
  const get = (t: string) => getVar(t).trim()
  const vars: Record<string, string> = {}
  for (const v of PALETTE_VARS) vars[v] = get(v)
  return {
    name,
    text: get(THEME_TOKENS.text),
    textMuted: get(THEME_TOKENS.textMuted),
    grid: get(THEME_TOKENS.grid),
    surface: get(THEME_TOKENS.surface),
    tooltipBg: get(THEME_TOKENS.tooltipBg),
    tooltipBorder: get(THEME_TOKENS.tooltipBorder),
    fontUi: get(THEME_TOKENS.fontUi),
    fontMono: get(THEME_TOKENS.fontMono),
    vars,
  }
}

/** A palette role (hex or TokenRef) as a concrete CSS color for this theme. */
export function paint(theme: ChartTheme, c: ColorOrToken): string {
  return resolve(c, (name) => theme.vars[name] ?? '')
}

/**
 * The ECharts theme object (`chart.setTheme` / `echarts.init(el, theme)`):
 * chrome only — text, axes, legend, tooltip, dataZoom, visualMap. Labels use
 * the UI font; axis tick labels (numbers, timestamps) use the mono font.
 * Data colors come from the builders, never from here.
 */
export function echartsTheme(t: ChartTheme): Record<string, unknown> {
  const label = { color: t.textMuted, fontFamily: t.fontMono, fontSize: 11 }
  const axis = {
    axisLine: { lineStyle: { color: t.grid } },
    axisTick: { lineStyle: { color: t.grid } },
    axisLabel: label,
    splitLine: { lineStyle: { color: t.grid, opacity: 0.6 } },
    nameTextStyle: { color: t.textMuted, fontFamily: t.fontUi, fontSize: 12 },
  }
  return {
    backgroundColor: 'transparent',
    textStyle: { color: t.text, fontFamily: t.fontUi },
    categoryAxis: { ...axis, axisLabel: { ...label, fontFamily: t.fontUi } },
    valueAxis: axis,
    logAxis: axis,
    timeAxis: axis,
    legend: {
      textStyle: { color: t.textMuted, fontFamily: t.fontUi, fontSize: 12 },
      inactiveColor: t.grid,
      pageTextStyle: { color: t.textMuted, fontFamily: t.fontMono },
      pageIconColor: t.text,
      pageIconInactiveColor: t.grid,
    },
    tooltip: {
      backgroundColor: t.tooltipBg,
      borderColor: t.tooltipBorder,
      textStyle: { color: t.text, fontFamily: t.fontUi, fontSize: 12 },
      axisPointer: {
        lineStyle: { color: t.textMuted },
        crossStyle: { color: t.textMuted },
        label: { backgroundColor: t.tooltipBg, color: t.text, fontFamily: t.fontMono },
      },
    },
    dataZoom: {
      borderColor: t.grid,
      textStyle: { color: t.textMuted, fontFamily: t.fontMono },
      handleStyle: { color: t.surface, borderColor: t.textMuted },
      moveHandleStyle: { color: t.textMuted },
      dataBackground: { lineStyle: { color: t.textMuted }, areaStyle: { color: t.grid } },
      fillerColor: /^#[0-9a-f]{6}$/i.test(t.tooltipBorder) ? withAlpha(t.tooltipBorder, 0.15) : t.tooltipBorder,
    },
    visualMap: { textStyle: { color: t.textMuted, fontFamily: t.fontMono } },
    markLine: { label: { color: t.textMuted } },
  }
}
