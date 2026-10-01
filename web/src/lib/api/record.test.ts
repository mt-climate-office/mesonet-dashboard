import { describe, expect, it } from 'vitest'
import { exclusiveEnd, fmtDate } from './record'
import { mergeOn } from './http'
import type { ObservationRow } from './types'

describe('exclusiveEnd', () => {
  it('adds one day to an inclusive end date', () => {
    expect(exclusiveEnd('2026-06-30')).toBe('2026-07-01')
    expect(exclusiveEnd('2026-06-15')).toBe('2026-06-16')
  })
  it('rolls over months and years', () => {
    expect(exclusiveEnd('2026-01-31')).toBe('2026-02-01')
    expect(exclusiveEnd('2025-12-31')).toBe('2026-01-01')
  })
  it('handles leap years', () => {
    expect(exclusiveEnd('2024-02-28')).toBe('2024-02-29')
    expect(exclusiveEnd('2025-02-28')).toBe('2025-03-01')
  })
  it('accepts Date (UTC date part)', () => {
    expect(exclusiveEnd(new Date(Date.UTC(2026, 8, 30, 12)))).toBe('2026-10-01')
  })
})

describe('fmtDate', () => {
  it('passes strings through and formats Dates as UTC YYYY-MM-DD', () => {
    expect(fmtDate('2026-06-01')).toBe('2026-06-01')
    expect(fmtDate(new Date(Date.UTC(2026, 5, 1)))).toBe('2026-06-01')
  })
})

describe('mergeOn', () => {
  const l: ObservationRow[] = [
    { station: 'a', datetime: 't1', x: 1 },
    { station: 'a', datetime: 't2', x: 2 },
  ]
  const r: ObservationRow[] = [{ station: 'a', datetime: 't2', y: 9 }]
  it('left-joins on keys', () => {
    expect(mergeOn(l, r, ['station', 'datetime'])).toEqual([
      { station: 'a', datetime: 't1', x: 1 },
      { station: 'a', datetime: 't2', x: 2, y: 9 },
    ])
  })
  it('returns the other side when one is empty', () => {
    expect(mergeOn([], r, ['station'])).toBe(r)
    expect(mergeOn(l, [], ['station'])).toBe(l)
  })
})
