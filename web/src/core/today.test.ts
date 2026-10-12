import { describe, expect, it } from 'vitest'
import { denverDay, denverToday, denverWallMs } from './today'

// 23:30 and 00:30 MDT (UTC−6), either side of local midnight; UTC is already Oct 3 at both.
const LATE = Date.parse('2026-10-03T05:30:00Z')
const EARLY = Date.parse('2026-10-03T06:30:00Z')

describe('denverToday', () => {
  it('is the Denver date, not the UTC one, at 23:30 MDT', () => {
    expect(denverToday(LATE)).toBe('2026-10-02')
  })
  it('turns over at Denver midnight (00:30 MDT)', () => {
    expect(denverToday(EARLY)).toBe('2026-10-03')
  })
  it('follows MST in winter (23:30 MST = 06:30 UTC)', () => {
    expect(denverToday(Date.parse('2026-01-16T06:30:00Z'))).toBe('2026-01-15')
  })
})

describe('denverDay', () => {
  it('formats and steps by calendar days from the Denver date', () => {
    expect(denverDay(LATE).format('YYYY-MM-DD')).toBe('2026-10-02')
    expect(denverDay(LATE).subtract(14, 'day').format('YYYY-MM-DD')).toBe('2026-09-18')
    expect(denverDay(EARLY).format('YYYY-MM-DD')).toBe('2026-10-03')
  })
})

describe('denverWallMs', () => {
  it('is the Denver wall clock as UTC ms, either side of local midnight and in winter', () => {
    expect(denverWallMs(LATE)).toBe(Date.UTC(2026, 9, 2, 23, 30))
    expect(denverWallMs(EARLY)).toBe(Date.UTC(2026, 9, 3, 0, 30))
    expect(denverWallMs(Date.parse('2026-01-16T06:30:00Z'))).toBe(Date.UTC(2026, 0, 15, 23, 30))
  })
})
