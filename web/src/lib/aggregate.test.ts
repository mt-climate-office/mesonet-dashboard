import { describe, expect, it } from 'vitest'
import {
  aggregateMonthly,
  DAYS_WITH_DATA_COLUMN,
  isSummedColumn,
  localMonthKey,
} from './aggregate'

const P = 'Precipitation [in]'
const T = 'Air Temperature @ 2 m [°F]'
const ET = 'Reference ET (a=0.23) [in]'
const M = 'Contains Missing Data'

const day = (d: string, extra: Record<string, unknown>) => ({
  station: 'acebozem',
  datetime: `${d} 00:00:00-06:00`,
  ...extra,
})

describe('isSummedColumn', () => {
  it('sums precipitation totals and reference ET only', () => {
    expect(isSummedColumn(P)).toBe(true)
    expect(isSummedColumn(ET)).toBe(true)
    expect(isSummedColumn('Max Precip Rate [in/h]')).toBe(false)
    expect(isSummedColumn(T)).toBe(false)
    expect(isSummedColumn('Feels Like Temperature [°F]')).toBe(false)
  })
})

describe('localMonthKey', () => {
  it('uses the local wall date of API datetimes', () => {
    expect(localMonthKey('2026-08-31 23:00:00-06:00')).toBe('2026-08')
    expect(localMonthKey('2026-09-01')).toBe('2026-09')
  })
  it('converts UTC strings to America/Denver', () => {
    // 2026-09-01T03:00Z is 2026-08-31 21:00 MDT
    expect(localMonthKey('2026-09-01T03:00:00Z')).toBe('2026-08')
  })
  it('returns null for garbage', () => {
    expect(localMonthKey(null)).toBeNull()
    expect(localMonthKey('n/a')).toBeNull()
  })
})

describe('aggregateMonthly', () => {
  const rows = [
    day('2026-08-30', { [T]: 60, [P]: 0.1, [ET]: 0.15, [M]: false, provisional: false, obs_count: 288 }),
    day('2026-08-31', { [T]: 70, [P]: 0.25, [ET]: 0.2, [M]: true, provisional: false, obs_count: 280 }),
    day('2026-09-01', { [T]: 50, [P]: null, [ET]: 0.1, [M]: false, provisional: true, obs_count: 288 }),
    day('2026-09-02', { [T]: null, [P]: 0.3, [ET]: 0.11, [M]: false, provisional: false, obs_count: 288 }),
  ]
  const out = aggregateMonthly(rows)

  it('groups by month with first-of-month datetimes, sorted', () => {
    expect(out.map((r) => r.datetime)).toEqual(['2026-08-01', '2026-09-01'])
  })

  it('sums precip/ET and averages the rest, ignoring nulls', () => {
    expect(out[0][P]).toBeCloseTo(0.35)
    expect(out[0][ET]).toBeCloseTo(0.35)
    expect(out[0][T]).toBe(65)
    expect(out[1][P]).toBeCloseTo(0.3)
    expect(out[1][T]).toBe(50)
  })

  it('ORs flag columns and keeps the station', () => {
    expect(out[0][M]).toBe(true)
    expect(out[1][M]).toBe(false)
    expect(out[0].provisional).toBe(false)
    expect(out[1].provisional).toBe(true)
    expect(out[0].station).toBe('acebozem')
  })

  it('adds Days With Data and drops obs_count', () => {
    expect(out[0][DAYS_WITH_DATA_COLUMN]).toBe(2)
    expect(out[1][DAYS_WITH_DATA_COLUMN]).toBe(2)
    expect('obs_count' in out[0]).toBe(false)
    expect(Object.keys(out[0]).at(-1)).toBe(DAYS_WITH_DATA_COLUMN)
  })

  it('keeps columns that only some rows carry (outer-joined derived)', () => {
    const res = aggregateMonthly([
      day('2026-08-01', { [T]: 1 }),
      day('2026-08-02', { [T]: 3, 'Feels Like Temperature [°F]': 5 }),
    ])
    expect(res[0]['Feels Like Temperature [°F]']).toBe(5)
    expect(res[0][T]).toBe(2)
  })

  it('returns null for an all-missing column and rounds to 3 decimals', () => {
    const res = aggregateMonthly([
      day('2026-08-01', { a: 1, b: null }),
      day('2026-08-02', { a: 1, b: null }),
      day('2026-08-03', { a: 2, b: null }),
    ])
    expect(res[0].a).toBe(1.333)
    expect(res[0].b).toBeNull()
  })

  it('handles empty input', () => {
    expect(aggregateMonthly([])).toEqual([])
  })
})
