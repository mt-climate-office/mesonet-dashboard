// Calendar-date helpers on `YYYY-MM-DD` strings, parsed by hand: never
// `new Date(string)`, whose parsing is time-zone and engine dependent (Safari).
// Used by dateRange.ts and dateInput.ts; callers may use clampRange directly.

export interface CalendarDate {
  year: number
  /** 1–12 */
  month: number
  /** 1–31 */
  day: number
}

export interface DateRange {
  start: string
  end: string
}

/** Which input an error belongs to, and its user-facing message. */
export interface DateError {
  field: 'start' | 'end'
  message: string
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Gregorian leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Days in `month` (1–12) of `year`. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** Parses a strict `YYYY-MM-DD` calendar date; null for any other shape or an impossible day. */
export function parseIsoDate(text: string): CalendarDate | null {
  const m = ISO.exec(text)
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

/** Formats a calendar date as zero-padded `YYYY-MM-DD`. */
export function formatIsoDate(d: CalendarDate): string {
  const pad = (n: number, w: number) => String(n).padStart(w, '0')
  return `${pad(d.year, 4)}-${pad(d.month, 2)}-${pad(d.day, 2)}`
}

/** True for a valid `YYYY-MM-DD` date. */
export function isIsoDate(text: string): boolean {
  return parseIsoDate(text) !== null
}

/** `date` limited to [min, max]; bounds may be omitted. Inputs must be valid ISO
 *  dates, which order correctly as strings. */
export function clampIsoDate(date: string, min?: string, max?: string): string {
  if (min && date < min) return min
  if (max && date > max) return max
  return date
}

/** Both ends clamped to [min, max], with start pulled down to end if they cross. */
export function clampRange(range: DateRange, min?: string, max?: string): DateRange {
  const start = clampIsoDate(range.start, min, max)
  const end = clampIsoDate(range.end, min, max)
  return { start: start > end ? end : start, end }
}

/** First problem with one date (empty, malformed, outside [min, max]) or null.
 *  `name` starts the message, e.g. "Start date". */
export function validateDate(date: string, name: string, min?: string, max?: string): string | null {
  if (date === '') return `${name} is required.`
  if (!isIsoDate(date)) return `${name} is not a valid date.`
  if (min && date < min) return `${name} must be on or after ${min}.`
  if (max && date > max) return `${name} must be on or before ${max}.`
  return null
}

/** First problem with a range (start, then end, then order) or null when it can be emitted. */
export function validateRange(range: DateRange, min?: string, max?: string): DateError | null {
  const start = validateDate(range.start, 'Start date', min, max)
  if (start) return { field: 'start', message: start }
  const end = validateDate(range.end, 'End date', min, max)
  if (end) return { field: 'end', message: end }
  if (range.start > range.end) return { field: 'start', message: 'Start date must be on or before end date.' }
  return null
}
