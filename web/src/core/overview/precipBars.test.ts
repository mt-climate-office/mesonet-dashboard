import { afterEach, describe, expect, it } from 'vitest'
import { setUnitsSource } from '../units'
import type { ObservationRow } from '../api'
import { precipBars, precipDailyQuery } from './precipBars'

const TODAY = '2026-10-01'
const row = (date: string, v: number | null): ObservationRow => ({ station: 'x', datetime: date, 'Precipitation [in]': v })
const WEEK = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']

describe('precipDailyQuery', () => {
  it('the 7 local days ending today, daily ppt at level 2; the key encodes every input', () => {
    expect(precipDailyQuery('acebozem', TODAY)).toEqual({
      key: 'obs:acebozem:daily:2026-09-25:2026-10-01:ppt:l2',
      query: { station: 'acebozem', start: '2026-09-25', end: TODAY, period: 'daily', elements: 'ppt', level: 2 },
    })
  })
})

describe('precipBars', () => {
  it('one bar per wet day, oldest first, each centred in its seventh of the width', () => {
    const r = precipBars(WEEK.map((d, i) => row(d, i === 0 ? 0.1 : i === 6 ? 0.4 : 0)), TODAY)!
    expect(r.spark.kind).toBe('bars')
    expect(r.spark.bars.map((b) => Math.round(b.x + b.w / 2))).toEqual([7, 93])
    expect(r.spark.max).toBe(0.4)
    expect(r.sparkLabel).toBe('Last 7 days: 0.50 in in total, precipitation on 2 days.')
  })
  it('a dry week: the zero baseline alone (no bars), read as "no precipitation"', () => {
    const r = precipBars(WEEK.map((d) => row(d, 0)), TODAY)!
    expect(r.spark).toMatchObject({ kind: 'bars', bars: [], points: 7 })
    expect(r.spark.d).toBe('M0 27h100v1h-100Z')
    expect(r.sparkLabel).toBe('Last 7 days: no precipitation.')
  })
  it('nothing with no rows, or before the rows load', () => {
    expect(precipBars([], TODAY)).toBeNull()
    expect(precipBars(undefined, TODAY)).toBeNull()
  })
  it('a missing day is a gap; rows outside the week are ignored', () => {
    const r = precipBars([row('2026-09-20', 2), row('2026-09-28', 0.2), row('2026-09-29', null)], TODAY)!
    expect(r.spark.points).toBe(1)
    expect(r.sparkLabel).toBe('Last 7 days: 0.20 in in total, precipitation on 1 day.')
  })
})

describe('precipBars in SI', () => {
  afterEach(() => setUnitsSource(() => 'us'))
  it('the sentence reads mm', () => {
    setUnitsSource(() => 'si')
    const r = precipBars(WEEK.map((d, i) => row(d, i === 0 ? 0.1 : i === 6 ? 0.4 : 0)), TODAY)!
    expect(r.sparkLabel).toBe('Last 7 days: 12.7 mm in total, precipitation on 2 days.')
  })
})
