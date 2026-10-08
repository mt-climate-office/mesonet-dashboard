import { describe, expect, it } from 'vitest'
import { autoAgg, effectiveAgg, intervalChips, intervalPatch, spanDays } from './interval'

const pressed = (c: ReturnType<typeof intervalChips>) => c.find((x) => x.pressed)?.id
const disabled = (c: ReturnType<typeof intervalChips>) => c.filter((x) => x.disabled).map((x) => x.id)

describe('interval', () => {
  it('measures the window in days (24 h = 1, 1 y = 365)', () => {
    expect(spanDays('2026-10-01', '2026-10-02')).toBe(1)
    expect(spanDays('2025-10-02', '2026-10-02')).toBe(365)
    expect(spanDays('junk', '2026-10-02')).toBe(0)
  })
  it('Auto: hourly up to 30 days, daily beyond and for All years', () => {
    expect(autoAgg(30)).toBe('hourly')
    expect(autoAgg(31)).toBe('daily')
    expect(autoAgg(1, true)).toBe('daily')
  })
  it('the effective interval: explicit wins unless not offered', () => {
    expect(effectiveAgg(null, 7)).toBe('hourly')
    expect(effectiveAgg('daily', 7)).toBe('daily')
    expect(effectiveAgg('raw', 7)).toBe('raw')
    expect(effectiveAgg('raw', 14)).toBe('hourly')
    expect(effectiveAgg('hourly', 365, true)).toBe('daily')
  })
  it('chips: 5-min only up to 7 days; All years only Auto; Auto names its pick', () => {
    const week = intervalChips(null, 7)
    expect(pressed(week)).toBe('auto')
    expect(week[0].label).toBe('Auto (hourly)')
    expect(disabled(week)).toEqual([])
    const month = intervalChips('raw', 30)
    expect(pressed(month)).toBe('auto')
    expect(disabled(month)).toEqual(['raw'])
    expect(month.find((c) => c.id === 'raw')?.reason).toMatch(/7 days/)
    expect(pressed(intervalChips('daily', 14))).toBe('daily')
    const all = intervalChips('daily', 0, true)
    expect(pressed(all)).toBe('auto')
    expect(all[0].label).toBe('Auto (daily)')
    expect(disabled(all)).toEqual(['raw', 'hourly', 'daily'])
    expect(all[1].reason).toBe('All years shows daily values')
  })
  it('Auto clears the key', () => {
    expect(intervalPatch('auto')).toEqual({ agg: null })
    expect(intervalPatch('raw')).toEqual({ agg: 'raw' })
  })
})
