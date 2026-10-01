import { describe, expect, it } from 'vitest'
import { groupByYear, hourlyToDaily, hoursInLocalDay, isCumulativeVariable } from './annual'

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

  it('rejects hourly timestamps and duplicate dates', () => {
    expect(() => groupByYear(['2025-07-01T00:00', '2025-07-01T23:00'], [1, 2])).toThrow(/hourlyToDaily/)
    expect(() => groupByYear(['2025-07-01', '2025-07-01'], [1, 2])).toThrow(/duplicate/)
  })

  it('NaN is treated as missing', () => {
    expect(groupByYear(['2025-01-01'], [NaN])[0].values).toEqual([null])
  })
})

function hours(date: string, n: number): string[] {
  return Array.from({ length: n }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`)
}

describe('hourlyToDaily', () => {
  it('groups by local date; sums need every hour of the local day', () => {
    const t = [...hours('2025-07-01', 24), ...hours('2025-07-02', 23), '2025-07-03T00:00']
    const v = t.map(() => 1)
    v[30] = null as unknown as number
    const out = hourlyToDaily(t, v, 'sum')
    expect(out.date).toEqual(['2025-07-01', '2025-07-02', '2025-07-03'])
    // Jul 2 has only 22 valid hours and Jul 3 one → null, not a low total.
    expect(out.values).toEqual([24, null, null])
    expect(hourlyToDaily(t, v, 'sum', { minHours: 1 }).values).toEqual([24, 22, 1])
    expect(hourlyToDaily(t, v, 'mean').values).toEqual([1, 1, 1])
  })

  it('DST days have 23 / 25 hours', () => {
    expect(hoursInLocalDay('2026-03-08')).toBe(23)
    expect(hoursInLocalDay('2025-11-02')).toBe(25)
    expect(hoursInLocalDay('2025-07-01')).toBe(24)
    const spring = hourlyToDaily(hours('2026-03-08', 23), Array(23).fill(1), 'sum')
    expect(spring.values).toEqual([23])
  })
})

it('isCumulativeVariable', () => {
  expect(isCumulativeVariable('ppt')).toBe(true)
  expect(isCumulativeVariable('ETo')).toBe(true)
  expect(isCumulativeVariable('air_temp')).toBe(false)
})
