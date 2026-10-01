import { describe, expect, it } from 'vitest'
import { currentConditionsRows, formatWindDirection } from './currentConditions'

describe('formatWindDirection', () => {
  it('matches legacy "{compass} ({deg} deg)"', () => {
    expect(formatWindDirection(357.3)).toBe('N (357.3 deg)')
    expect(formatWindDirection(225)).toBe('SW (225 deg)')
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
