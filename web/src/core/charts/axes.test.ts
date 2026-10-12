import { describe, expect, it } from 'vitest'
import { dayTicks, dualAxis, fitAxisNames, logAxis, logExtent, niceCeil, valueAxis, timeAxis, timeTickLabel } from './axes'

describe('axes', () => {
  it('time axis: 12-hour labels read in UTC (= Denver wall clock), fewer ticks on compact', () => {
    type Fmt = (v: number, i: number, extra?: { level?: number }) => string
    const a = timeAxis() as { type: string; splitNumber: number; axisLabel: { formatter: Fmt } }
    expect(a.type).toBe('time')
    expect(a.axisLabel.formatter(Date.UTC(2026, 9, 3, 16), 0, { level: 0 })).toBe('4 PM')
    expect(a.axisLabel.formatter(Date.UTC(2026, 9, 1), 0, { level: 1 })).toBe('Oct 1')
    expect(a.axisLabel.formatter(Date.UTC(2026, 9, 1), 0, { level: 0 })).toBe('Oct')
    expect((timeAxis({ compact: true }) as { splitNumber: number }).splitNumber).toBeLessThan(a.splitNumber)
  })
  it('compact time axis over 3–60 days: evenly spaced whole days, centred in the window', () => {
    const d = (mo: number, day: number) => Date.UTC(2026, mo, day)
    const label = (t: number) => timeTickLabel(t, true)
    // 14 days (Sep 23 through Oct 7, the axis ends at Oct 8 00:00): 4 days apart, never a month-start snap.
    expect(dayTicks(d(8, 23), d(9, 8)).map(label)).toEqual(['Sep 24', 'Sep 28', 'Oct 2', 'Oct 6'])
    expect(dayTicks(d(9, 1), d(9, 8)).map(label)).toEqual(['Oct 1', 'Oct 3', 'Oct 5', 'Oct 7'])
    const month = dayTicks(d(8, 7), d(9, 8))
    expect(month.length).toBeLessThanOrEqual(4)
    expect(new Set(month.slice(1).map((t, i) => t - month[i])).size).toBe(1)
    expect(dayTicks(d(9, 6), d(9, 8))).toEqual([])
    expect(dayTicks(d(0, 1), d(9, 8))).toEqual([])
    type Ax = { axisLabel: { customValues?: number[]; formatter: (v: number, i: number) => string }; axisTick: { customValues?: number[] } }
    const a = timeAxis({ min: d(8, 23), max: d(9, 8), compact: true }) as Ax
    expect(a.axisLabel.customValues).toEqual(dayTicks(d(8, 23), d(9, 8)))
    expect(a.axisTick.customValues).toEqual(a.axisLabel.customValues)
    expect(a.axisLabel.formatter(d(9, 1), 0)).toBe('Oct 1')
    expect((timeAxis({ min: d(8, 23), max: d(9, 8) }) as Ax).axisLabel.customValues).toBeUndefined()
  })
  it('time tick labels: hours as on Now, days, a month beside days names its day, Jan 1 the year', () => {
    const at = (mo: number, d: number, h = 0, m = 0) => Date.UTC(2026, mo, d, h, m)
    const hours = [at(9, 3, 6), at(9, 3, 12), at(9, 3, 18), at(9, 3, 6, 30), at(9, 3, 12, 15)].map((t) => timeTickLabel(t, false))
    expect(hours).toEqual(['6 AM', 'Noon', '6 PM', '6:30 AM', '12:15 PM'])
    expect(timeTickLabel(at(9, 3), true)).toBe('Oct 3')
    expect(timeTickLabel(at(8, 29), false)).toBe('Sep 29')
    expect(timeTickLabel(at(9, 1), true)).toBe('Oct 1')
    expect(timeTickLabel(at(9, 1), false)).toBe('Oct')
    expect(timeTickLabel(at(0, 1), true)).toBe('2026')
  })
  it('fitAxisNames drops only the y titles longer than their plot (short charts)', () => {
    const name = 'Cumulative reference ET (in)' // 28 chars × 12 px × 0.6 ≈ 202 px
    const opt = { grid: { top: 24, bottom: 56 }, yAxis: [valueAxis(name), valueAxis('ETr (in)', { right: true })] }
    const short = fitAxisNames(opt, 234).yAxis as { name: string }[]
    expect(short.map((a) => a.name)).toEqual(['', 'ETr (in)'])
    expect((fitAxisNames(opt, 420).yAxis as { name: string }[])[0].name).toBe(name)
    const panels = { grid: [{ top: 30, height: 160 }], yAxis: { ...valueAxis('Air temperature (°F)'), nameTextStyle: { fontSize: 10 } } }
    expect((fitAxisNames(panels, 900).yAxis as { name: string }).name).toBe('Air temperature (°F)')
    // A horizontal panel title (the Download preview) runs along the plot: never dropped.
    const titled = { grid: [{ top: 34, height: 80 }], yAxis: [{ type: 'value' as const, name: 'Air Temperature @ 2 m [°F]', nameLocation: 'end' as const }] }
    expect((fitAxisNames(titled, 900).yAxis as { name: string }[])[0].name).toBe('Air Temperature @ 2 m [°F]')
  })
  it('dual axis: both from 0, y2 on the right, aligned, no split lines', () => {
    const [l, r] = dualAxis('A', 'B', { rightMax: 50 }) as Record<string, unknown>[]
    expect(l).toMatchObject({ type: 'value', name: 'A', min: 0, position: 'left' })
    expect(r).toMatchObject({ name: 'B', min: 0, max: 50, position: 'right', alignTicks: true, splitLine: { show: false } })
  })
  it('log axis with prefix and inverse', () => {
    const a = logAxis('SWP', 0.1, 100, { inverse: true, prefix: '-' }) as { type: string; inverse: boolean; axisLabel: { formatter: (v: number) => string } }
    expect(a).toMatchObject({ type: 'log', inverse: true })
    expect(a.axisLabel.formatter(15)).toBe('-15')
  })
  it('niceCeil / logExtent', () => {
    expect([0, 0.7, 1, 1.3, 5100, 9001].map(niceCeil)).toEqual([1, 0.8, 1, 1.5, 6000, 10000])
    expect(logExtent(0.4, 30, [0.33, 15])).toEqual([0.1, 100])
    expect(logExtent(NaN, NaN)).toEqual([0.1, 100])
  })
})
