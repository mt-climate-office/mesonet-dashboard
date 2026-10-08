/**
 * Sends a GoatCounter beacon on first load and on every view change (a
 * section, or a chart within Charts), and `countEvent` for actions
 * (core/analytics decides whether and what). Fire-and-forget: a blocked or
 * failed beacon never affects the page.
 */
import Alpine from 'alpinejs'
import { campaignQuery, countUrl, eventUrl, referrerHost, screenSize, shouldCount, viewPath } from '../../core/analytics'
import { sectionLabel } from '../../core/router'

// The landing query string, read at module load, before any in-app navigation changes it.
const landingSearch = location.search
let enabled = false

const screen = (): string => screenSize(window.screen.width, window.screen.height, window.devicePixelRatio || 1)

const send = (url: string): void => {
  try {
    navigator.sendBeacon(url)
  } catch {
    // Ignore: counting is best-effort.
  }
}

/** Count an action (`download/csv`, `station/acewetz`); a no-op where counting is off. */
export function countEvent(name: string, title: string): void {
  if (enabled) send(eventUrl(name, title, screen()))
}

export function startAnalytics(): void {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (!shouldCount({ hostname: location.hostname, doNotTrack: nav.doNotTrack, gpc: nav.globalPrivacyControl === true })) return
  enabled = true
  // The effect runs once now (the landing view, with its referrer and campaign) and again whenever the view changes.
  let last: string | null = null
  Alpine.effect(() => {
    const url = Alpine.store('url')
    const view = viewPath(url.section, { v: url.state.v, cmp: url.state.cmp })
    if (view === last) return
    const title = view === url.section ? sectionLabel(url.section) : `${sectionLabel(url.section)}: ${view.slice(view.indexOf('/') + 1)}`
    const landing = last === null ? { referrer: referrerHost(document.referrer, location.hostname), campaign: campaignQuery(landingSearch) } : {}
    send(countUrl(location.pathname, view, title, { screen: screen(), ...landing }))
    last = view
  })
  // Each station viewed, once per change (the landing station included).
  let station: string | null = null
  Alpine.effect(() => {
    const id = Alpine.store('station').id
    if (id && id !== station) countEvent(`station/${id}`, 'Station viewed')
    station = id
  })
}
