import { describe, expect, it } from 'vitest'
import { denverWallMs } from '../today'
import { dayMs, msDay, partialDay, untilNow, viewAnnouncement, windowRange, zoomDates, zoomWindow } from './view'

const DAY = 86_400_000

describe('window ↔ ms', () => {
  it('round-trips dates and covers the end day', () => {
    expect(msDay(dayMs('2026-09-17'))).toBe('2026-09-17')
    const [a, b] = windowRange('2026-09-17', '2026-10-01')
    expect(b - a).toBe(15 * DAY)
  })
  it('turns a zoom into day-granular, clamped dates', () => {
    const [a, b] = windowRange('2026-09-20', '2026-09-25')
    expect(zoomDates(a, b, '2026-10-01', null)).toEqual({ start: '2026-09-20', end: '2026-09-25' })
    expect(zoomDates(a + 3_600_000, b - 3_600_000, '2026-10-01', null)).toEqual({ start: '2026-09-20', end: '2026-09-25' })
    expect(zoomDates(a, b + 30 * DAY, '2026-10-01', '2026-09-22')).toEqual({ start: '2026-09-22', end: '2026-10-01' })
  })
  it('keeps the fetch window while the view stays inside the loaded days', () => {
    const loaded = { start: '2026-09-20', end: '2026-09-25' }
    const [a, b] = windowRange(loaded.start, loaded.end)
    const H = 3_600_000
    // Zoom in below a day, or pan by part of a day inside the data: no refetch, no snap.
    expect(zoomWindow([a + 5 * H, a + 7 * H], loaded, '2026-10-01', null)).toBeNull()
    expect(zoomWindow([a, b], loaded, '2026-10-01', null)).toBeNull()
    // Past the loaded days: the days the view touches.
    expect(zoomWindow([a - 6 * H, b - 30 * H], loaded, '2026-10-01', null)).toEqual({ start: '2026-09-19', end: '2026-09-24' })
    expect(zoomWindow([a - 2 * DAY, b + 2 * DAY], loaded, '2026-10-01', null)).toEqual({ start: '2026-09-18', end: '2026-09-27' })
    // Clamped back to the same window (before the install date): nothing to do.
    expect(zoomWindow([a - DAY, b], loaded, '2026-10-01', '2026-09-20')).toBeNull()
  })
  it('announces the view', () => {
    expect(viewAnnouncement('Bozeman', 'hourly', '2026-09-17', '2026-10-01', 5)).toBe(
      'Chart updated: Bozeman, hourly data, Sep 17, 2026 to Oct 1, 2026, 5 variables.',
    )
  })
})

describe('the day in progress', () => {
  // 00:30 MDT on Oct 3 (an injected clock): Denver's day has just turned over.
  const now = denverWallMs(Date.parse('2026-10-03T06:30:00Z'))
  const win = windowRange('2026-09-19', '2026-10-03')
  const H = 3_600_000
  it('hourly and 5-min views end at the next hour, not at tonight’s midnight', () => {
    expect(untilNow(win, 'hourly', now)).toEqual([win[0], dayMs('2026-10-03') + H])
    expect(untilNow(win, 'raw', now)[1]).toBe(dayMs('2026-10-03') + H)
    // On the hour: that hour.
    expect(untilNow(win, 'hourly', dayMs('2026-10-03') + 2 * H)[1]).toBe(dayMs('2026-10-03') + 2 * H)
  })
  it('daily keeps today’s whole slot; a past window is unchanged', () => {
    expect(untilNow(win, 'daily', now)).toEqual(win)
    const past = windowRange('2026-09-01', '2026-09-10')
    expect(untilNow(past, 'hourly', now)).toEqual(past)
  })
  it('marks today’s daily row as partial', () => {
    const x = [dayMs('2026-10-02'), dayMs('2026-10-03')]
    expect(partialDay('daily', x, '2026-10-03')).toBe(dayMs('2026-10-03'))
    expect(partialDay('daily', x.slice(0, 1), '2026-10-03')).toBeNull()
    expect(partialDay('hourly', x, '2026-10-03')).toBeNull()
  })
})

