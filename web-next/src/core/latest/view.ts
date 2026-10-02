/**
 * The Latest plot's x window in Denver wall-clock ms: URL dates → the
 * visible range and the zoomable axis extent, a user zoom → URL dates, and
 * the live-region sentence for a new view.
 */
import { formatIsoDate, parseIsoDate } from '../controls/dateModel'
import type { LatestAgg } from '../url-schema'

const DAY = 86_400_000

/** YYYY-MM-DD → wall-clock ms at 00:00 (no `new Date(string)`). */
export function dayMs(iso: string): number {
  const d = parseIsoDate(iso)
  if (!d) throw new Error(`dayMs: bad date "${iso}"`)
  return Date.UTC(d.year, d.month - 1, d.day)
}

/** Wall-clock ms → its YYYY-MM-DD. */
export function msDay(ms: number): string {
  const d = new Date(ms)
  return formatIsoDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() })
}

/** Inclusive dates → visible range [start 00:00, end + 1 day 00:00). */
export function windowRange(start: string, end: string): [number, number] {
  return [dayMs(start), dayMs(end) + DAY]
}

/**
 * Zoomable axis extent: the window padded by its own length on each side
 * (so the user can zoom out to 3× and pan, which refetches), never past
 * tomorrow 00:00 or before the install date.
 */
export function axisExtent(view: [number, number], today: string, installed: string | null): [number, number] {
  const span = view[1] - view[0]
  const lo = Math.max(view[0] - span, installed ? dayMs(installed) : -Infinity)
  const hi = Math.min(view[1] + span, dayMs(today) + DAY)
  return [Math.min(lo, view[0]), Math.max(hi, view[1])]
}

/**
 * A user zoom → inclusive dates for `from`/`to`: the days the window
 * touches, clamped to install date … today (day-granular, like the pickers).
 */
export function zoomDates(fromMs: number, toMs: number, today: string, installed: string | null): { start: string; end: string } {
  let start = msDay(fromMs)
  // A window ending exactly at midnight does not include that day.
  let end = msDay(Math.max(fromMs, toMs - 1))
  if (end > today) end = today
  if (installed && start < installed) start = installed
  if (start > end) start = end
  return { start, end }
}

const AGG_WORD: Record<LatestAgg, string> = { hourly: 'hourly', daily: 'daily', raw: 'raw' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const longDate = (iso: string) => {
  const d = parseIsoDate(iso)
  return d ? `${MONTHS[d.month - 1]} ${d.day}, ${d.year}` : iso
}

/** Live-region text after the plot redraws for a new station, window or aggregation. */
export function viewAnnouncement(station: string, agg: LatestAgg, start: string, end: string, panels: number): string {
  const what = panels === 1 ? '1 variable' : `${panels} variables`
  return `Chart updated: ${station}, ${AGG_WORD[agg]} data, ${longDate(start)} to ${longDate(end)}, ${what}.`
}
