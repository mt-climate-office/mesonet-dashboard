/**
 * Sends a GoatCounter beacon on first load and on every section change
 * (core/analytics decides whether and what). Fire-and-forget: a blocked or
 * failed beacon never affects the page.
 */
import Alpine from 'alpinejs'
import { countUrl, shouldCount } from '../../core/analytics'
import { sectionLabel, type Section } from '../../core/router'

export function startAnalytics(): void {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (!shouldCount({ hostname: location.hostname, doNotTrack: nav.doNotTrack, gpc: nav.globalPrivacyControl === true })) return
  const send = (section: Section) => {
    try {
      nav.sendBeacon(countUrl(location.pathname, section, sectionLabel(section)))
    } catch {
      // Ignore: counting is best-effort.
    }
  }
  // The effect runs once now (the landing view) and again whenever the section changes.
  let last: Section | null = null
  Alpine.effect(() => {
    const s = Alpine.store('url').section
    if (s !== last) send(s)
    last = s
  })
}
