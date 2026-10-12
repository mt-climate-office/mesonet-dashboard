/**
 * Time helpers for the photo archive. Camera slots are local wall-clock times
 * in America/Denver; archive keys carry UTC instants in the compact form
 * `YYYYMMDDTHHMMSSZ`. Only the Intl API is used (no dayjs timezone plugin).
 */

export const PHOTO_ZONE = 'America/Denver'

const DAY_MS = 86_400_000

const PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: PHOTO_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
})

const LOCAL_YMD_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: PHOTO_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const LOCAL_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: PHOTO_ZONE,
  hourCycle: 'h12',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** The label's parts by type. Built from parts, not format(): engines join date and time differently
 *  (WebKit's ICU writes "Oct 1, 2026 at 3:00 PM", V8 "Oct 1, 2026, 3:00 PM"). */
function labelParts(ms: number): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of LOCAL_LABEL_FMT.formatToParts(new Date(ms))) if (p.type !== 'literal') out[p.type] = p.value
  return out
}

/** Zone offset (ms, local − UTC) in effect at instant `ms`. */
function offsetAt(ms: number): number {
  const parts = PARTS_FMT.formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return Math.round((asUtc - ms) / 60_000) * 60_000
}

/**
 * Local wall-clock `YYYY-MM-DD` + `HH:MM[:SS]` in America/Denver → UTC instant.
 * DST-safe: a second pass corrects a guess that straddles the change.
 */
export function localToUtcMs(ymd: string, hhmm = '00:00'): number {
  const [y, mo, d] = ymd.split('-').map(Number)
  const [h, mi, s] = hhmm.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0)
  let ms = wall - offsetAt(wall)
  const off2 = offsetAt(ms)
  if (wall - off2 !== ms) ms = wall - off2
  return ms
}

/** Instant → `YYYYMMDDTHHMMSSZ`. */
export function compactUtc(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '')
}

/** `YYYYMMDDTHHMMSSZ` (or any ISO string `Date.parse` accepts) → instant, or NaN. */
export function parseUtc(s: string): number {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  return s ? Date.parse(s) : NaN
}

/** UTC calendar day of an instant, `YYYYMMDD` (the listing prefix). */
export function utcYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, '')
}

/** Local (America/Denver) calendar day of an instant, `YYYY-MM-DD`. */
export function localYmd(ms: number): string {
  return LOCAL_YMD_FMT.format(new Date(ms))
}

/** `YYYY-MM-DD` shifted by `n` calendar days. */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10)
}

/** UTC days (`YYYYMMDD`) that a local day overlaps. */
export function utcDaysOfLocalDay(ymd: string): string[] {
  const start = localToUtcMs(ymd)
  const end = localToUtcMs(addDays(ymd, 1)) - 1
  const a = utcYmd(start)
  const b = utcYmd(end)
  return a === b ? [a] : [a, b]
}

/** "3:00 PM" in America/Denver (the same in every engine). */
export function formatLocalTime(ms: number): string {
  const p = labelParts(ms)
  return `${p.hour}:${p.minute} ${p.dayPeriod.toUpperCase()}`
}

/** "Oct 1, 2026 3:00 PM" in America/Denver (the same in every engine). */
export function formatLocal(ms: number): string {
  const p = labelParts(ms)
  return `${p.month} ${p.day}, ${p.year} ${formatLocalTime(ms)}`
}
