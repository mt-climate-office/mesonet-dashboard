import { describe, expect, it } from 'vitest'
import { groupByYear, hourlyToDaily, isCumulativeVariable } from './annual'

describe('groupByYear', () => {
  it('splits by local calendar year with leap-aware DOY', () => {
    const out = groupByYear(['2024-03-01', '2023-12-31', '2024-12-31', '2023-03-01'], [1, 2, 3, 4])
    expect(out.map((t) => t.year)).toEqual([2023, 2024])
    expect(out[0]).toEqual({ year: 2023, date: ['2023-03-01', '2023-12-31'], doy: [60, 365], values: [4, 2] })
    expect(out[1].doy).toEqual([61, 366])
  })

  it('cumulative skips nulls and resets each year', () => {
    const out = groupByYear(
      ['2024-12-30', '2024-12-31', '2025-01-01', '2025-01-02', '2025-01-03'],
      [1, 2, null, 5, null],
      { cumulative: true },
    )
    expect(out[0].values).toEqual([1, 3])
    expect(out[1].values).toEqual([null, 5, 5])
  })

  it('NaN is treated as missing', () => {
    expect(groupByYear(['2025-01-01'], [NaN])[0].values).toEqual([null])
  })
})

describe('hourlyToDaily', () => {
  it('groups by local date', () => {
    const out = hourlyToDaily(
      ['2025-07-01T23:00', '2025-07-01T22:00', '2025-07-02T00:00', '2025-07-03T00:00'],
      [1, 2, 4, null],
      'sum',
    )
    expect(out).toEqual({ date: ['2025-07-01', '2025-07-02', '2025-07-03'], values: [3, 4, null] })
    expect(hourlyToDaily(['2025-07-01T00:00', '2025-07-01T01:00'], [1, 2], 'mean').values).toEqual([1.5])
  })
})

it('isCumulativeVariable', () => {
  expect(isCumulativeVariable('ppt')).toBe(true)
  expect(isCumulativeVariable('ETo')).toBe(true)
  expect(isCumulativeVariable('air_temp')).toBe(false)
})
