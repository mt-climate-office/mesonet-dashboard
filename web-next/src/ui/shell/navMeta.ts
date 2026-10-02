/**
 * `x-data="navMeta"` on the navbar's right-hand group: Share (copy link →
 * toast + live region) and the 3-state theme toggle (`$store.theme`). The
 * Help button is wired by its dialog (ui/shell/helpDialog.ts).
 */
import Alpine from 'alpinejs'
import { component } from '../component'
import { announce } from './live'

const THEME_NAMES = { dark: 'Dark', light: 'Light', 'high-contrast': 'High-contrast' } as const

export function navMeta() {
  return component({
    /**
     * Copy the view's URL. `$store.url` batches writes into one replaceState
     * per microtask, so wait one turn: the address bar is then exactly what
     * the store wrote (the whole view state, legacy `state` already gone).
     * The result also goes to the page live region: the kit creates its toast
     * element on first use, and a just-inserted live region is often not read.
     */
    async share() {
      await new Promise<void>((r) => queueMicrotask(r))
      let msg = 'Link copied to clipboard'
      let ms: number | undefined
      try {
        await navigator.clipboard.writeText(location.href)
      } catch {
        msg = 'Could not copy. Copy the address bar to share this view.'
        ms = 6000
      }
      MCO.showToast(msg, ms)
      announce(msg)
    },

    cycleTheme() {
      const theme = Alpine.store('theme')
      theme.cycle()
      announce(`${THEME_NAMES[theme.current]} theme`)
    },

    get themeLabel(): string {
      return Alpine.store('theme').label
    },

    /** Which icon the toggle shows: the theme a click switches to. */
    get themeIcon(): 'sun' | 'contrast' | 'moon' {
      const t = Alpine.store('theme').current
      return t === 'dark' ? 'sun' : t === 'light' ? 'contrast' : 'moon'
    },
  })
}
