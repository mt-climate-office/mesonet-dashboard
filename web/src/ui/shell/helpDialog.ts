/**
 * `x-data="helpDialog"` on `#help-modal` (partials/help.html): the kit
 * dialog, opened by `openHelp()` (the header menu's Help item), with the API docs
 * link from core/config.ts, this app's own example address and the kit's credit line. Backdrop click, `[data-close-modal]`,
 * Esc and focus return (to whatever was focused when it opened: the ⋯
 * button, since the menu closes first) come from `MCO.initInfoModal`. Focus opens on the title
 * (`autofocus`, no ring); the box fades at the bottom while it has more to scroll.
 */
import { API_DOCS_URL } from '../../core/config'
import { component } from '../component'
import { initScrollFade } from '../layout/scrollFade'

const EVENT = 'dash:help'

/** Open the Help dialog from anywhere. */
export const openHelp = (): void => void window.dispatchEvent(new CustomEvent(EVENT))

export function helpDialog() {
  let off: (() => void) | null = null
  return component({
    apiDocsUrl: API_DOCS_URL,
    /** This app's address with a station, wherever it is served (the Pages root, or `/dash/next/` behind the proxy). */
    exampleUrl: new URL(`${import.meta.env.BASE_URL}?s=crowagen`, location.origin).href,
    /** The family's credit line (Data section), never hand-typed. */
    credit: MCO.credit({ source: 'Montana Mesonet' }),

    init() {
      // No first-visit auto-open: web/ never auto-opened Help (DIVERGENCES "Global UI").
      const dialog = this.$el as HTMLDialogElement
      const modal = MCO.initInfoModal({ dialog, trigger: null })
      const onOpen = () => modal.open()
      window.addEventListener(EVENT, onOpen)
      const unfade = initScrollFade(dialog.querySelector<HTMLElement>('.info-modal-box')!)
      off = () => {
        window.removeEventListener(EVENT, onOpen)
        unfade()
      }
    },
    destroy() {
      off?.()
    },
  })
}
