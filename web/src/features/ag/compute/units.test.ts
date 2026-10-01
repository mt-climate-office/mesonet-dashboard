import { describe, expect, it } from 'vitest'
import { barToKPa, cToF, deltaCToF, deltaFToC, fToC, inToMm, kPaToBar, mmToIn, mphToMs, msToMph } from './units'
import { denverMidnightEpochMs, denverOffsetMinutes, dayOfYear } from './util'

describe('units', () => {
  it('converts and round-trips', () => {
    expect(fToC(212)).toBe(100)
    expect(cToF(-40)).toBe(-40)
    expect(mphToMs(1)).toBe(0.44704)
    expect(msToMph(mphToMs(37))).toBeCloseTo(37, 12)
    expect(mmToIn(25.4)).toBe(1)
    expect(inToMm(2)).toBe(50.8)
    expect(kPaToBar(1500)).toBe(15)
    expect(barToKPa(0.33)).toBeCloseTo(33, 12)
    expect(deltaCToF(5)).toBe(9)
    expect(deltaFToC(9)).toBe(5)
  })

  it('passes null through', () => {
    expect(fToC(null)).toBeNull()
    expect(kPaToBar(null)).toBeNull()
  })
})

describe('time helpers', () => {
  it('day of year from local strings', () => {
    expect(dayOfYear('2025-01-01')).toBe(1)
    expect(dayOfYear('2024-12-31T23:00')).toBe(366)
  })

  it('Denver local midnight across DST', () => {
    expect(denverOffsetMinutes(Date.parse('2026-01-15T12:00Z'))).toBe(-420)
    expect(denverOffsetMinutes(Date.parse('2025-07-15T12:00Z'))).toBe(-360)
    expect(new Date(denverMidnightEpochMs('2025-07-01')).toISOString()).toBe('2025-07-01T06:00:00.000Z')
    expect(new Date(denverMidnightEpochMs('2026-01-01')).toISOString()).toBe('2026-01-01T07:00:00.000Z')
    // DST start/end days: midnight is still on the previous offset.
    expect(new Date(denverMidnightEpochMs('2026-03-08')).toISOString()).toBe('2026-03-08T07:00:00.000Z')
    expect(new Date(denverMidnightEpochMs('2025-11-02')).toISOString()).toBe('2025-11-02T06:00:00.000Z')
  })
})
