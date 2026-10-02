/**
 * `x-data="helpDialog"` on `#help-modal` (partials/help.html): wires the kit
 * dialog to the navbar "?" button and supplies the links that live in
 * core/config.ts. Backdrop click, `[data-close-modal]`, Esc and focus return
 * come from `MCO.initInfoModal`.
 */
import { API_DOCS_URL, FEEDBACK_URL } from '../../core/config'
import { LEGACY_SATELLITE_URL } from '../../core/notices'
import { component } from '../component'

export function helpDialog() {
  return component({
    apiDocsUrl: API_DOCS_URL,
    feedbackUrl: FEEDBACK_URL,
    satelliteUrl: LEGACY_SATELLITE_URL,

    init() {
      // No first-visit auto-open: web/ never auto-opened Help (DIVERGENCES "Global UI").
      MCO.initInfoModal({ dialog: this.$el as HTMLDialogElement, trigger: document.getElementById('btn-help') })
    },
  })
}
