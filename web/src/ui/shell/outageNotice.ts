/**
 * `x-data="outageNotice"` on `#outage-modal` (partials/outage.html): fetches
 * `outage.json` through `$store.data`, and opens the kit dialog once per tab
 * per notice id (core/outage.ts `claimOutage`). Message Markdown is rendered
 * by core/markdown.ts, which escapes all input HTML.
 */
import Alpine from 'alpinejs'
import { renderMarkdown } from '../../core/markdown'
import {
  DEFAULT_OUTAGE_CONFIG,
  OUTAGE_TONE_LABELS,
  claimOutage,
  fetchOutageConfig,
  outageTone,
  type OutageConfig,
  type OutageTone,
} from '../../core/outage'
import { component } from '../component'

/** Legacy re-checked GitHub every 60 s; failures resolve inactive, never throw. */
const OUTAGE_TTL_MS = 60 * 1000

function tabStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function outageNotice() {
  return component({
    config: { ...DEFAULT_OUTAGE_CONFIG } as OutageConfig,
    poll: 0,

    destroy() {
      clearInterval(this.poll)
    },

    init() {
      const dialog = this.$el as HTMLDialogElement
      const modal = MCO.initInfoModal({ dialog })
      const res = Alpine.store('data').cached('outage', () => fetchOutageConfig(), {
        ttl: OUTAGE_TTL_MS,
        retry: false,
      })
      // cached() is read once here, so its TTL alone never refetches: poll,
      // so a notice posted while the tab is open still appears. Hidden tabs
      // skip the request.
      this.poll = window.setInterval(() => {
        if (!document.hidden) res.refresh()
      }, OUTAGE_TTL_MS)

      // Runs now and whenever the resource lands or refreshes.
      Alpine.effect(() => {
        const cfg = res.data
        if (!cfg || dialog.open || !claimOutage(cfg, tabStorage())) return
        this.config = cfg
        // Open after Alpine has rendered the new title and message.
        this.$nextTick(() => modal.open())
      })
    },

    get tone(): OutageTone {
      return outageTone(this.config.color)
    },

    get toneLabel(): string {
      return OUTAGE_TONE_LABELS[this.tone]
    },

    /** Safe HTML (escaped text + generated <p>/<strong>/<em>/<a>) for x-html. */
    get messageHtml(): string {
      return renderMarkdown(this.config.message)
    },
  })
}
