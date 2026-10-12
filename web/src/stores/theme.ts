/**
 * `$store.theme`: the kit's theme (`MCO.getTheme`, the 3-state `MCO.toggleTheme({ cycle: true })`,
 * `MCO.setTheme`) as reactive state, with the menu item's names (core/theme.ts). `MCO.setTheme` fires
 * the kit's `mco:themechange` on `document` (`detail.theme`), which chart and map hosts listen for.
 */
import Alpine from 'alpinejs'
import { themeName, themeToggleLabel, type Theme } from '../core/theme'

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
      this.set(MCO.toggleTheme({ cycle: true }))
    },

    set(theme) {
      MCO.setTheme(theme)
      this.current = theme
      // A ?theme= in the address bar would win on reload; keep it truthful.
      const url = Alpine.store('url')
      if (url.state.theme !== null) url.set({ theme })
    },
  }
}
