import { describe, expect, it } from 'vitest'
import { dayMs, msDay, viewAnnouncement, windowRange, zoomDates, zoomWindow } from './view'

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

