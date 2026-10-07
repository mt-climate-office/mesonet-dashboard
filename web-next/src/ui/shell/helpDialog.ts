/**
 * `x-data="helpDialog"` on `#help-modal` (partials/help.html): the kit
 * dialog, opened by `openHelp()` (the header menu's Help item), with the
 * links that live in core/config.ts, this app's own example address and the
 * network's station count (from the station catalog). Backdrop click, `[data-close-modal]`,
 * Esc and focus return (to whatever was focused when it opened: the ⋯
 * button, since the menu closes first) come from `MCO.initInfoModal`.
 */
import { API_DOCS_URL, FEEDBACK_URL } from '../../core/config'
import { LEGACY_SATELLITE_URL } from '../../core/notices'
import Alpine from 'alpinejs'
import { component } from '../component'

const EVENT = 'dash:help'

/** Open the Help dialog from anywhere. */
export const openHelp = (): void => void window.dispatchEvent(new CustomEvent(EVENT))

export function helpDialog() {
  let off: (() => void) | null = null
  return component({
    apiDocsUrl: API_DOCS_URL,
    feedbackUrl: FEEDBACK_URL,
    satelliteUrl: LEGACY_SATELLITE_URL,
    /** This app's address with a station, wherever it is served (`/next/` now, its own path after cutover). */
    exampleUrl: new URL(`${import.meta.env.BASE_URL}?s=crowagen`, location.origin).href,
    /** Stations in the catalog; 0 while it loads (the sentence then hides). */
    stationCount: (): number => Alpine.store('station').list.length,

    init() {
      // No first-visit auto-open: web/ never auto-opened Help (DIVERGENCES "Global UI").
      const modal = MCO.initInfoModal({ dialog: this.$el as HTMLDialogElement, trigger: null })
      const onOpen = () => modal.open()
      window.addEventListener(EVENT, onOpen)
      off = () => window.removeEventListener(EVENT, onOpen)
    },
    destroy() {
      off?.()
    },
  })
}
