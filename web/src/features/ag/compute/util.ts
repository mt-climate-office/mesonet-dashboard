/** Internal helpers shared by the compute modules. Not part of the public API. */
import type { LocalDate, LocalDateTime, Nullable } from '../contract'

/** True for a finite number (rejects null, NaN and ±Infinity). */
export function ok(x: Nullable | undefined): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

/** Convert NaN/±Infinity/undefined to null so outputs never carry NaN. */
export function clean(x: number | null | undefined): Nullable {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

/** Day of year (1–366) of a local date or local datetime string. */
export function dayOfYear(local: LocalDate | LocalDateTime): number {
  const y = Number(local.slice(0, 4))
  const m = Number(local.slice(5, 7))
  const d = Number(local.slice(8, 10))
  return (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000 + 1
}

/** UTC epoch ms of local midnight-as-UTC for a `"YYYY-MM-DD"` (for date arithmetic only). */
export function dateToUtcMs(date: LocalDate): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
}

/** Inverse of {@link dateToUtcMs}. */
export function utcMsToDate(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10)
}

/** `"YYYY-MM-DD"` + n days. */
export function addDays(date: LocalDate, n: number): LocalDate {
  return utcMsToDate(dateToUtcMs(date) + n * 86_400_000)
}

let denverFmt: Intl.DateTimeFormat | null = null

/** America/Denver UTC offset (minutes, e.g. -420 for MST) at an instant. */
export function denverOffsetMinutes(epochMs: number): number {
  denverFmt ??= new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const p: Record<string, number> = {}
  for (const part of denverFmt.formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return Math.round((asUtc - Math.floor(epochMs / 60_000) * 60_000) / 60_000)
}

/**
 * UTC epoch ms of local (America/Denver) midnight for a daily row. DST
 * changes at 02:00 local, so the offset at 00:00 MST (07:00Z) on the same
 * calendar day is the offset in force at midnight.
 */
export function denverMidnightEpochMs(date: LocalDate): number {
  const utcMidnight = dateToUtcMs(date)
  return utcMidnight - denverOffsetMinutes(utcMidnight + 7 * 3_600_000) * 60_000
}

/** Epoch ms for each daily row (local midnight); daily contract inputs carry no epochMs. */
export function dailyEpochMs(dates: LocalDate[]): number[] {
  return dates.map(denverMidnightEpochMs)
}
