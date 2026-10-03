/**
 * Page counts for GoatCounter: no cookies, no personal data. One count per
 * section view, sent as the path plus the section (`/mesonet-dashboard/next/#charts`);
 * the station, query string and referrer are never sent. Skipped when the
 * visitor asks not to be tracked (Do Not Track or Global Privacy Control) and
 * off production hosts (dev, preview, verify).
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

/** Beacon URL for one view of `section` at `pathname`; `title` is the section label. */
export function countUrl(pathname: string, section: string, title: string): string {
  const q = new URLSearchParams({ p: `${pathname}#${section}`, t: title, rnd: Math.random().toString(36).slice(2) })
  return `${GOATCOUNTER_URL}?${q}`
}
