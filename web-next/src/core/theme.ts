/**
 * Theme cycle for the header menu's Theme item (stores/theme.ts): dark → light →
 * high-contrast → dark. The kit owns applying a theme (`MCO.setTheme`); this
 * file only decides the order and the button's accessible name.
 */
import { THEMES, type Theme } from './url-schema'

export { THEMES, type Theme }

/** Name of the window event every theme-aware view (charts, maps) listens for. */
export const THEME_EVENT = 'mco-theme-change'

/** The theme after `t`; unknown values restart the cycle at dark. */
export function nextTheme(t: string): Theme {
  const i = (THEMES as readonly string[]).indexOf(t)
  return THEMES[(i + 1) % THEMES.length]
}

/** True for a value the kit accepts in `data-theme`. */
export const isTheme = (t: unknown): t is Theme => (THEMES as readonly unknown[]).includes(t)

const NAMES: Record<Theme, string> = { dark: 'dark', light: 'light', 'high-contrast': 'high-contrast' }

/** Toggle `aria-label`: names the theme a click switches TO (kit convention). */
export function themeToggleLabel(current: string): string {
  return `Switch to ${NAMES[nextTheme(current)]} theme`
}

/** The visible state of the Theme menu item: "Dark", "Light", "High contrast". */
export function themeName(t: string): string {
  return t === 'high-contrast' ? 'High contrast' : t === 'light' ? 'Light' : 'Dark'
}
