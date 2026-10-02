/**
 * `x-data="navMeta"` on the navbar's right-hand group: Share (copy link →
 * toast), Help (native `<dialog>` via `MCO.initInfoModal`) and the 3-state
 * theme toggle (`$store.theme`).
 */
import Alpine from 'alpinejs'
import { component } from '../component'

export function navMeta() {
  return component({
    init() {
      const dialog = document.getElementById('help-modal') as HTMLDialogElement | null
      const trigger = document.getElementById('btn-help')
      // Backdrop click, [data-close-modal], Esc and focus return all come from the kit.
      if (dialog) MCO.initInfoModal({ dialog, trigger })
    },

    /** Copy the current URL (the URL is the whole view state) and confirm with a toast. */
    async share() {
      try {
        await navigator.clipboard.writeText(location.href)
        MCO.showToast('Link copied to clipboard')
      } catch {
        MCO.showToast('Could not copy. Copy the address bar to share this view.', 6000)
      }
    },

    cycleTheme() {
      Alpine.store('theme').cycle()
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
