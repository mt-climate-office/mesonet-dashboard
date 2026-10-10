/**
 * Test-only: a `ChartContext` per theme built from the kit 0.11.2 token
 * values (palette's TOKENS_SNAPSHOT plus the chrome tokens charts read).
 * Imported by core/charts/*.test.ts; never by app code.
 */
import { TOKENS_SNAPSHOT } from '../palette/tokens.snapshot'
import type { Theme } from '../palette'
import { ZOOM_TRACE_ID } from './style'
import { readChartTheme } from './theme'
import type { ChartContext } from './types'

// Copied from mco-theme.css 0.11.2 (:root, [data-theme=light], [data-theme=high-contrast]).
const CHROME: Record<Theme, Record<string, string>> = {
  dark: { '--text-secondary': '#c0cad6', '--border': '#3a4558', '--glass': 'rgba(30,37,48,0.92)', '--accent-line': '#5aaee8' },
  light: { '--text-secondary': '#3a3f4b', '--border': '#c8cdd5', '--glass': 'rgba(255,255,255,0.94)', '--accent-line': '#1563a0' },
  'high-contrast': { '--text-secondary': '#f5f5f5', '--border': '#8a8a8a', '--glass': 'rgba(0,0,0,0.96)', '--accent-line': '#93d0ff' },
}
const FONTS = { '--font-ui': "'Outfit', system-ui, sans-serif", '--font-mono': "'Space Mono', ui-monospace, monospace" }

/** Fake `getVar` for a theme. */
export const fakeGetVar = (theme: Theme) => (name: string): string =>
  ({ ...TOKENS_SNAPSHOT[theme], ...CHROME[theme], ...FONTS })[name] ?? ''

/** Builder context for a theme at a desktop width (mouse unless `touch`). */
export function testCtx(theme: Theme = 'dark', width = 900, compact = false, touch = false): ChartContext {
  return { theme: readChartTheme(theme, fakeGetVar(theme)), width, compact, touch }
}

/** A built option's series without the zoom slider's hidden trace (style `zoomTrace`). */
export function drawn<S>(o: { series?: unknown }): S[] {
  return ((o.series ?? []) as { id?: string }[]).filter((s) => s.id !== ZOOM_TRACE_ID) as S[]
}

/** A built option's y axes without the trace's hidden one (`show: false`). */
export function shownY<A>(o: { yAxis?: unknown }): A[] {
  const all = (Array.isArray(o.yAxis) ? o.yAxis : [o.yAxis]) as { show?: boolean }[]
  return all.filter((a) => a.show !== false) as A[]
}
