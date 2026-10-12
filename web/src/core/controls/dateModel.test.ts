// Tests for hand-rolled ISO date parsing, leap years, clamping and validation.

import { describe, expect, it } from 'vitest'
import {
  clampIsoDate,
  clampRange,
  daysInMonth,
  formatIsoDate,
  isIsoDate,
  isLeapYear,
  parseIsoDate,
  validateDate,
  validateRange,
} from './dateModel'

describe('isLeapYear / daysInMonth', () => {
  it('follows the Gregorian rules', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2023)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
  })

  it('counts February by leap year and the 30-day months', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2023, 2)).toBe(28)
    expect(daysInMonth(2100, 2)).toBe(28)
    expect(daysInMonth(2024, 4)).toBe(30)
    expect(daysInMonth(2024, 12)).toBe(31)
  })
})

describe('parseIsoDate / formatIsoDate', () => {
  it('parses strict YYYY-MM-DD', () => {
    expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
  })

  it('rejects impossible days and other shapes', () => {
    for (const bad of ['2023-02-29', '2100-02-29', '2024-04-31', '2024-13-01', '2024-00-10', '2024-1-01', '2024-01-01T00:00', '', 'May 1']) {
      expect(parseIsoDate(bad), bad).toBeNull()
      expect(isIsoDate(bad), bad).toBe(false)
    }
  })

  it('zero-pads when formatting and round-trips', () => {
    expect(formatIsoDate({ year: 987, month: 3, day: 7 })).toBe('0987-03-07')
    expect(formatIsoDate(parseIsoDate('2000-02-29')!)).toBe('2000-02-29')
  })
})

describe('clamping', () => {
  const min = '2016-01-01'
  const max = '2026-10-01'

  it('clamps a date to optional bounds', () => {
    expect(clampIsoDate('2010-05-05', min, max)).toBe(min)
    expect(clampIsoDate('2030-05-05', min, max)).toBe(max)
    expect(clampIsoDate('2020-02-29', min, max)).toBe('2020-02-29')
    expect(clampIsoDate('1900-01-01')).toBe('1900-01-01')
  })

  it('clamps a range into a new period of record', () => {
    expect(clampRange({ start: '2010-01-01', end: '2030-01-01' }, min, max)).toEqual({ start: min, end: max })
    // Entirely before the period: both ends land on min.
    expect(clampRange({ start: '2010-01-01', end: '2012-01-01' }, min, max)).toEqual({ start: min, end: min })
    // Crossed input: start is pulled down to end.
    expect(clampRange({ start: '2024-06-01', end: '2024-05-01' }, min, max)).toEqual({ start: '2024-05-01', end: '2024-05-01' })
  })
})

describe('validation', () => {
  it('reports empty, malformed and out-of-range single dates', () => {
    expect(validateDate('', 'Date')).toBe('Date is required.')
    expect(validateDate('2023-02-29', 'Date')).toBe('Date is not a valid date.')
    expect(validateDate('2015-12-31', 'Date', '2016-01-01')).toBe('Date must be on or after 2016-01-01.')
    expect(validateDate('2027-01-01', 'Date', undefined, '2026-10-01')).toBe('Date must be on or before 2026-10-01.')
    expect(validateDate('2024-02-29', 'Date', '2016-01-01', '2026-10-01')).toBeNull()
  })

  it('flags the offending end of a range, then order', () => {
    expect(validateRange({ start: '', end: '2024-01-01' })).toEqual({ field: 'start', message: 'Start date is required.' })
    expect(validateRange({ start: '2024-01-01', end: '2031-01-01' }, undefined, '2026-10-01')).toEqual({
      field: 'end',
      message: 'End date must be on or before 2026-10-01.',
    })
    expect(validateRange({ start: '2024-03-01', end: '2024-02-29' })).toEqual({
      field: 'start',
      message: 'Start date must be on or before end date.',
    })
    expect(validateRange({ start: '2024-02-29', end: '2024-02-29' })).toBeNull()
  })
})
