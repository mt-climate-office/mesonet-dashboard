/**
 * `$store.theme`: wraps the kit's `MCO.getTheme/setTheme` with the 3-state
 * cycle (core/theme.ts). Every change fires one `mco-theme-change` window
 * event (`detail.theme`) that chart and map hosts listen for.
 */
import Alpine from 'alpinejs'
import { THEME_EVENT, nextTheme, themeName, themeToggleLabel, type Theme } from '../core/theme'

export interface ThemeStore {
  current: Theme
  /** Accessible hint for the toggle: the theme a click switches to ("Switch to light theme"). */
  readonly label: string
  /** The current theme's visible name ("Dark", "Light", "High contrast"). */
  readonly name: string
  /** dark → light → high-contrast → dark. */
  cycle(): void
  set(theme: Theme): void
  init(): void
}

export function createThemeStore(): ThemeStore {
  return {
    current: 'dark',

    init() {
      // The inline anti-flash script already applied ?theme= / saved / OS.
      this.current = MCO.getTheme()
    },

    get label() {
      return themeToggleLabel(this.current)
    },

    get name() {
      return themeName(this.current)
    },

    cycle() {
      this.set(nextTheme(this.current))
    },

    set(theme) {
      MCO.setTheme(theme)
      this.current = theme
      // A ?theme= in the address bar would win on reload; keep it truthful.
      const url = Alpine.store('url')
      if (url.state.theme !== null) url.set({ theme })
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }))
    },
  }
}
