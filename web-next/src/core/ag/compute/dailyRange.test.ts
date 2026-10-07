import { describe, expect, it } from 'vitest'
import { hourlyMet } from '../__tests__/adapters'
import { cciDailyRange, cciHourly, dailyExtremes, feelsLikeDailyRange, feelsLikeHourly } from '.'

const hours = (day: string, n: number) => Array.from({ length: n }, (_, h) => `${day}T${String(h).padStart(2, '0')}:00`)

describe('dailyExtremes', () => {
  it('takes each day’s high and low hour; a short day is null except the last', () => {
    const time = [...hours('2026-07-01', 24), ...hours('2026-07-02', 10), ...hours('2026-07-03', 5)]
    const v = time.map((_, i) => (i === 14 ? 40 : i === 4 ? 5 : i < 24 ? 20 : 30))
    const e = dailyExtremes(time, v, time.map((_, i) => i === 30))
    expect(e.date).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
    expect([e.high[0], e.low[0], e.highAt[0], e.lowAt[0]]).toEqual([40, 5, 14, 4])
    expect([e.high[1], e.low[1]]).toEqual([null, null])
    expect([e.high[2], e.low[2]]).toEqual([30, 30])
    expect(e.provisional).toEqual([false, true, false])
  })
  it('skips nulls; an all-null day is null', () => {
    const time = hours('2026-01-01', 24)
    expect(dailyExtremes(time, time.map(() => null)).high).toEqual([null])
    const v = time.map((_, i) => (i < 20 ? -5 + i : null))
    expect(dailyExtremes(time, v).high).toEqual([14])
  })
})

describe('daily ranges from hourly', () => {
  const met = hourlyMet('acebozem', 'jul2025')
  it('feels-like high/low are the extremes of the hourly feels-like, with the regime at that hour', () => {
    const r = feelsLikeDailyRange(met)
    const fl = feelsLikeHourly(met)
    const day = r.date[3]
    const ix = met.time.flatMap((t, i) => (t.startsWith(day) ? [i] : []))
    const vals = ix.map((i) => fl.valueC[i]!).filter((v) => v != null)
    expect(r.highC[3]).toBe(Math.max(...vals))
    expect(r.lowC[3]).toBe(Math.min(...vals))
    expect(r.airHighC[3]).toBe(Math.max(...ix.map((i) => met.tC[i]!).filter((v) => v != null)))
    expect(r.highRegime[3]).toBe(fl.regime[ix[vals.indexOf(r.highC[3]!)]])
  })
  it('summer daily highs reach the heat index that a daily mean never does', () => {
    const r = feelsLikeDailyRange(met)
    expect(r.highRegime).toContain('heat_index')
    expect(r.highC.filter((v) => v != null).every((v, i) => v! >= r.lowC[i]!)).toBe(true)
  })
  it('CCI high/low with their classes; newborn only changes the classes', () => {
    const a = cciDailyRange(met, 'adult')
    const n = cciDailyRange(met, 'newborn')
    const hourly = cciHourly(met, 'adult')
    const day = a.date[5]
    const vals = met.time.flatMap((t, i) => (t.startsWith(day) && hourly.valueC[i] != null ? [hourly.valueC[i]!] : []))
    expect(a.highC[5]).toBe(Math.max(...vals))
    expect(n.highC).toEqual(a.highC)
    expect(a.livestock).toBe('adult')
    expect(a.highClass.length).toBe(a.date.length)
  })
})
