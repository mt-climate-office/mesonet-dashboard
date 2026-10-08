/**
 * Page counts for GoatCounter: no cookies, no personal data. One count per
 * view, sent as the path plus the view (`/mesonet-dashboard/next/#charts/air_temp`),
 * with the screen size, and on landing the referring site (host only) and any
 * `utm_*` campaign tags. Events count actions (a download, a share, a station
 * viewed). The query string's other keys and the full referrer are never sent.
 * Skipped when the visitor asks not to be tracked (Do Not Track or Global
 * Privacy Control) and off production hosts (dev, preview, verify).
 */
import { GOATCOUNTER_URL } from './config'

export interface CountEnv {
  hostname: string
  /** `navigator.doNotTrack` ("1" = opt out). */
  doNotTrack: string | null
  /** `navigator.globalPrivacyControl`. */
  gpc: boolean
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', ''])

/** Whether to send counts at all in this browser. */
export function shouldCount(env: CountEnv): boolean {
  return !LOCAL_HOSTS.has(env.hostname) && env.doNotTrack !== '1' && !env.gpc
}

/** The counted view: the section, and on Charts the open chart or Ag tool (`charts/air_temp`, `charts/compare`). */
export function viewPath(section: string, state: { v?: string | null; cmp?: boolean }): string {
  if (section !== 'charts') return section
  if (state.cmp) return 'charts/compare'
  return state.v ? `charts/${state.v}` : 'charts'
}

/** GoatCounter's screen field: "width,height,devicePixelRatio". */
export const screenSize = (width: number, height: number, dpr: number): string => `${width},${height},${dpr}`

/** The referring site's host (no `www.`), or '' for none, the app's own host, or an unreadable value. */
export function referrerHost(referrer: string, ownHost: string): string {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    return host === ownHost.replace(/^www\./, '') ? '' : host
  } catch {
    return ''
  }
}

/** Only the `utm_*` keys of `search`, as a query string GoatCounter reads campaigns from ('' for none). */
export function campaignQuery(search: string): string {
  const keep = [...new URLSearchParams(search)].filter(([k]) => k.startsWith('utm_'))
  return keep.length ? `?${new URLSearchParams(keep)}` : ''
}

export interface CountExtras {
  /** `screenSize(...)`. */
  screen?: string
  /** `referrerHost(...)`; landing view only. */
  referrer?: string
  /** `campaignQuery(...)`; landing view only. */
  campaign?: string
}

const beacon = (params: Record<string, string>): string => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== ''))
  q.set('rnd', Math.random().toString(36).slice(2))
  return `${GOATCOUNTER_URL}?${q}`
}

/** Beacon URL for one view (`viewPath`) at `pathname`; `title` names it. */
export function countUrl(pathname: string, view: string, title: string, extras: CountExtras = {}): string {
  return beacon({ p: `${pathname}#${view}`, t: title, s: extras.screen ?? '', r: extras.referrer ?? '', q: extras.campaign ?? '' })
}

/** Beacon URL for an event (`download/csv`, `station/acewetz`); GoatCounter lists events apart from pages. */
export function eventUrl(name: string, title: string, screen = ''): string {
  return beacon({ p: name, t: title, e: 'true', s: screen })
}
