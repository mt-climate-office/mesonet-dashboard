/**
 * Now's NWS hazard banners: active alerts (core/api `fetchNwsAlerts`) → a
 * tone, a time phrase and the text, most serious first. Pure: the time comes
 * in as `nowWallMs` (Denver wall clock).
 */
import type { NwsAlert } from '../api'

/** The kit's notice tones (mco-notice data-tone). */
export type AlertTone = 'danger' | 'warning' | 'info'

export interface AlertBanner {
  id: string
  /** "Winter Storm Warning": the banner's tone word. */
  event: string
  tone: AlertTone
  /** "until 6 PM Tue", "from 6 PM Mon until noon Tue", or "". */
  when: string
  description: string
  instruction: string
}

/**
 * NWS colors by product: warnings red, watches and advisories amber, the
 * rest (statements, outlooks) informational. An Extreme or Severe alert of any
 * other kind still reads as danger.
 */
export function alertTone(a: Pick<NwsAlert, 'event' | 'severity'>): AlertTone {
  if (/warning|emergency/i.test(a.event) || /extreme|severe/i.test(a.severity)) return 'danger'
  if (/watch|advisory/i.test(a.event)) return 'warning'
  return 'info'
}

const day = (t: number) => Math.floor(t / 86_400_000)
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "6 PM Tue", "6:30 AM Wed", "noon Tue" (wall-clock ms, read as UTC), or "6 PM today" on `nowWallMs`'s day. */
function at(t: number, nowWallMs: number): string {
  const d = new Date(t)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const time = h === 12 && m === 0 ? 'noon' : `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
  return day(t) === day(nowWallMs) ? `${time} today` : `${time} ${DAYS[d.getUTCDay()]}`
}

/** "until 6 PM Tue" while it is in effect, "from … until …" before it starts (the day once when both fall on it), "" without an end. */
export function alertWhen(a: Pick<NwsAlert, 'onset' | 'ends'>, nowWallMs: number): string {
  const until = a.ends === null ? '' : `until ${at(a.ends, nowWallMs)}`
  if (a.onset === null || a.onset <= nowWallMs) return until
  const from = at(a.onset, nowWallMs)
  const sameDay = a.ends !== null && day(a.onset) === day(a.ends)
  return [`from ${sameDay ? from.split(' ').slice(0, 2).join(' ') : from}`, until].filter(Boolean).join(' ')
}

const RANK: Record<AlertTone, number> = { danger: 0, warning: 1, info: 2 }

/** The banners for alerts not yet ended, danger first, then by start. */
export function alertBanners(alerts: readonly NwsAlert[] | undefined, nowWallMs: number): AlertBanner[] {
  return (alerts ?? [])
    .filter((a) => a.ends === null || a.ends > nowWallMs)
    .map((a) => ({ a, tone: alertTone(a) }))
    .sort((x, y) => RANK[x.tone] - RANK[y.tone] || (x.a.onset ?? 0) - (y.a.onset ?? 0))
    .map(({ a, tone }) => ({
      id: a.id,
      event: a.event,
      tone,
      when: alertWhen(a, nowWallMs),
      description: a.description,
      instruction: a.instruction,
    }))
}
