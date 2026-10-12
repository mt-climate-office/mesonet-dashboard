/**
 * Share: copy `$store.url.href`, the canonical URL of the view (it includes a
 * write the store has not flushed yet). The header's "Share this view" and a
 * chart's "Share this chart" both call it. The result also goes to the page
 * live region: the kit creates its toast element on first use, and a
 * just-inserted live region is often not read.
 */
import Alpine from 'alpinejs'
import { countEvent } from './analytics'
import { announce } from './live'

export async function shareView(): Promise<void> {
  let msg = 'Link copied to clipboard'
  let ms: number | undefined
  try {
    await navigator.clipboard.writeText(Alpine.store('url').href)
    countEvent('share', 'Link copied')
  } catch {
    msg = 'Could not copy. Copy the address bar to share this view.'
    ms = 6000
  }
  MCO.showToast(msg, ms)
  announce(msg)
}
