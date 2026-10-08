/**
 * "Today" for the whole app: the calendar date in America/Denver, whatever
 * the browser's own zone (a viewer elsewhere, or a UTC test browser, still
 * gets Montana's day). Every default date, window and "since midnight" reads it.
 */
import dayjs, { type Dayjs } from 'dayjs'

const DENVER_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' })
const DENVER_HM = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })

/** Today's America/Denver date at instant `now` (epoch ms), `YYYY-MM-DD`. */
export function denverToday(now: number = Date.now()): string {
  return DENVER_YMD.format(new Date(now))
}

/** The same day as a dayjs (browser-local midnight), for calendar arithmetic and formatting only. */
export function denverDay(now: number = Date.now()): Dayjs {
  return dayjs(denverToday(now))
}

/**
 * The America/Denver wall clock at instant `now` as chart x ms (the local reading parsed as if UTC,
 * as chart models carry it; core/sensorEvents `parseWallClock`), to the minute.
 */
export function denverWallMs(now: number = Date.now()): number {
  const [y, mo, d] = denverToday(now).split('-').map(Number)
  const parts = DENVER_HM.formatToParts(new Date(now))
  const part = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return Date.UTC(y, mo - 1, d, part('hour'), part('minute'))
}
