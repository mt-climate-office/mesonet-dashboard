import { describe, expect, it } from 'vitest'
import { currentConditionsRows, formatLatestStamp, formatWindDirection, pptSummaryRows } from './currentConditions'

describe('formatWindDirection', () => {
  it('matches legacy "{compass} ({deg} deg)"', () => {
    expect(formatWindDirection(357.3)).toBe('N (357.3 deg)')
    expect(formatWindDirection(225)).toBe('SW (225.0 deg)')
    expect(formatWindDirection(90)).toBe('E (90.0 deg)')
  })
})

describe('currentConditionsRows', () => {
  it('keeps legacy rows in API order, Timestamp first, Real Feel last', () => {
    const rows = currentConditionsRows({
      station: 'mdamalta',
      datetime: '2026-10-01 13:15:00-06:00',
      'Air Temperature [°F]': 60.08,
      'Precipitation [in]': 0,
      'Soil VWC @ 4 in [%]': 15.8,
      'Bulk EC @ 36 in [mS/cm]': null,
      'VPD [mbar]': 9.3,
      'Wind Direction [deg]': 69.6,
      'Wind Speed [mi/hr]': 10.021,
      'Well EC [mS/cm]': 6.902,
      'Well Water Level [in]': 128.622,
      'Well Water Temperature [°F]': 47.12,
      provisional: true,
    })
    expect(rows.map(([k]) => k)).toEqual([
      'Timestamp',
      'Air Temperature [°F]',
      'Precipitation [in]',
      'Soil VWC @ 4 in [%]',
      'Wind Direction [deg]',
      'Wind Speed [mi/hr]',
      'Well Water Level [in]',
      'Real Feel [°F]',
    ])
    expect(rows.find(([k]) => k === 'Wind Direction [deg]')?.[1]).toBe('ENE (69.6 deg)')
    expect(rows.find(([k]) => k === 'Air Temperature [°F]')?.[1]).toBe('60.08')
    // 35.74 + 0.6215·60.08 − 35.75·V^0.16 + 0.4275·60.08·V^0.16, V = 10.021
    expect(rows[rows.length - 1][1]).toBe('58.53')
  })
})

describe('formatLatestStamp', () => {
  it('reads the Mountain wall clock, ignoring the offset', () => {
    expect(formatLatestStamp('2026-10-01 13:15:00-06:00')).toBe('Oct 1, 2026 1:15 PM')
    expect(formatLatestStamp('2026-01-05 00:05:00-07:00')).toBe('Jan 5, 2026 12:05 AM')
    expect(formatLatestStamp('2026-01-05 12:00:00-07:00')).toBe('Jan 5, 2026 12:00 PM')
    expect(formatLatestStamp('garbage')).toBe('garbage')
  })
  it('is the Timestamp row', () => {
    expect(currentConditionsRows({ datetime: '2026-10-01 13:15:00-06:00' })[0]).toEqual(['Timestamp', 'Oct 1, 2026 1:15 PM'])
  })
})

describe('pptSummaryRows', () => {
  it('numeric columns in reverse order with " in", station and blanks dropped', () => {
    expect(
      pptSummaryRows({ station: 'acebozem', 'Precip. Year to Date': 10.123, 'Precip. Past 30 Days': '1.5', 'Precip. Past 7 Days': null, 'Precip. Past 24 Hours': 0 }),
    ).toEqual([
      ['Precip. Past 24 Hours', '0.00 in'],
      ['Precip. Past 30 Days', '1.50 in'],
      ['Precip. Year to Date', '10.12 in'],
    ])
    expect(pptSummaryRows(undefined)).toEqual([])
  })
})
