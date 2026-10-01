import { describe, expect, it } from 'vitest'
import {
  aggregateMonthly,
  DAYS_WITH_DATA_COLUMN,
  daysInMonth,
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

/** Every day of a month, with per-day values from `f(dayOfMonth)`. */
const month = (ym: string, f: (d: number) => Record<string, unknown>) =>
  Array.from({ length: daysInMonth(ym) }, (_, i) =>
    day(`${ym}-${String(i + 1).padStart(2, '0')}`, f(i + 1)),
  )

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

describe('daysInMonth', () => {
  it('knows month lengths and leap years', () => {
    expect(daysInMonth('2026-08')).toBe(31)
    expect(daysInMonth('2026-09')).toBe(30)
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2026-02')).toBe(28)
  })
})

describe('aggregateMonthly', () => {
  // Full August: complete. Full September except one null precip day.
  const rows = [
    ...month('2026-08', (d) => ({
      [T]: d <= 15 ? 60 : 70,
      [P]: 0.1,
      [ET]: 0.2,
      [M]: false,
      provisional: false,
      obs_count: 288,
    })),
    ...month('2026-09', (d) => ({
      [T]: 50,
      [P]: d === 10 ? null : 0.1,
      [ET]: 0.1,
      [M]: false,
      provisional: d === 30,
      obs_count: 288,
    })),
  ]
  const out = aggregateMonthly(rows)

  it('groups by month with first-of-month datetimes, sorted', () => {
    expect(out.map((r) => r.datetime)).toEqual(['2026-08-01', '2026-09-01'])
  })

  it('sums precip/ET for complete months and averages the rest', () => {
    expect(out[0][P]).toBeCloseTo(3.1)
    expect(out[0][ET]).toBeCloseTo(6.2)
    expect(out[0][T]).toBeCloseTo((15 * 60 + 16 * 70) / 31, 3)
  })

  it('leaves a sum null when any day of the month is missing, but keeps means', () => {
    expect(out[1][P]).toBeNull()
    expect(out[1][ET]).toBeCloseTo(3.0)
    expect(out[1][T]).toBe(50)
  })

  it('flags missing data from a null day as well as the API flag', () => {
    expect(out[0][M]).toBe(false)
    expect(out[1][M]).toBe(true)
    const apiFlag = aggregateMonthly(month('2026-08', (d) => ({ [T]: 1, [M]: d === 3 })))
    expect(apiFlag[0][M]).toBe(true)
  })

  it('treats absent days (partial month / dropped rows) as incomplete', () => {
    const partial = aggregateMonthly(
      month('2026-08', () => ({ [P]: 0.1, [T]: 5, [M]: false })).slice(14),
    )
    expect(partial[0][DAYS_WITH_DATA_COLUMN]).toBe(17)
    expect(partial[0][P]).toBeNull()
    expect(partial[0][T]).toBe(5)
    expect(partial[0][M]).toBe(true)
  })

  it('reproduces the arskeogh Aug 2026 case: 1-of-31-day ETr is not a total', () => {
    const res = aggregateMonthly(month('2026-08', (d) => ({ [ET]: d === 1 ? 0.147 : null })))
    expect(res[0][ET]).toBeNull()
    expect(res[0][M]).toBe(true)
  })

  it('ORs provisional and keeps the station', () => {
    expect(out[0].provisional).toBe(false)
    expect(out[1].provisional).toBe(true)
    expect(out[0].station).toBe('acebozem')
  })

  it('adds Days With Data (row count) last and drops obs_count', () => {
    expect(out[0][DAYS_WITH_DATA_COLUMN]).toBe(31)
    expect(out[1][DAYS_WITH_DATA_COLUMN]).toBe(30)
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
    expect(res[0][M]).toBe(true)
  })

  it('returns null for an all-missing column and rounds means to 3 decimals', () => {
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
