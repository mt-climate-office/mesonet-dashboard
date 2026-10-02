/**
 * Test-only: a `ChartContext` per theme built from the kit 0.7.1 token
 * values (palette's TOKENS_SNAPSHOT plus the chrome tokens charts read).
 * Imported by core/charts/*.test.ts; never by app code.
 */
import { TOKENS_SNAPSHOT } from '../palette/tokens.snapshot'
import type { Theme } from '../palette'
import { readChartTheme } from './theme'
import type { ChartContext } from './types'

// Copied from mco-theme.css 0.7.1 (:root, [data-theme=light], [data-theme=high-contrast]).
const CHROME: Record<Theme, Record<string, string>> = {
  dark: { '--text-secondary': '#c0cad6', '--border': '#3a4558', '--glass': 'rgba(30,37,48,0.82)', '--accent-line': '#5aaee8' },
  light: { '--text-secondary': '#3a3f4b', '--border': '#c8cdd5', '--glass': 'rgba(255,255,255,0.88)', '--accent-line': '#1563a0' },
  'high-contrast': { '--text-secondary': '#f5f5f5', '--border': '#8a8a8a', '--glass': 'rgba(0,0,0,0.96)', '--accent-line': '#93d0ff' },
}
const FONTS = { '--font-ui': "'Outfit', system-ui, sans-serif", '--font-mono': "'Space Mono', ui-monospace, monospace" }

/** Fake `getVar` for a theme. */
export const fakeGetVar = (theme: Theme) => (name: string): string =>
  ({ ...TOKENS_SNAPSHOT[theme], ...CHROME[theme], ...FONTS })[name] ?? ''

/** Builder context for a theme at a desktop width. */
export function testCtx(theme: Theme = 'dark', width = 900, compact = false): ChartContext {
  return { theme: readChartTheme(theme, fakeGetVar(theme)), width, compact }
}
