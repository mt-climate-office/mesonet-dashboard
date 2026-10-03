/**
 * "Today" for the whole app: the calendar date in America/Denver, whatever
 * the browser's own zone (a viewer elsewhere, or a UTC test browser, still
 * gets Montana's day). Every default date, window and "since midnight" reads it.
 */
import dayjs, { type Dayjs } from 'dayjs'

const DENVER_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Today's America/Denver date at instant `now` (epoch ms), `YYYY-MM-DD`. */
export function denverToday(now: number = Date.now()): string {
  return DENVER_YMD.format(new Date(now))
}

/** The same day as a dayjs (browser-local midnight), for calendar arithmetic and formatting only. */
export function denverDay(now: number = Date.now()): Dayjs {
  return dayjs(denverToday(now))
}
