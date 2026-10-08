import { describe, expect, it } from 'vitest'
import type { SwpSeries } from '../contract'
import { SWP_CAPPED_SHARE, annualAxisLabel, depthLabel, dropCappedDepths, fromSi, stageText } from './labels'

// Ported from web/src/features/ag/figures/figures.test.ts (the renderer-free parts).
describe('Ag display helpers', () => {
  it('depth labels use the dashboard inch names', () => {
    expect([5, 10, 20, 50, 70, 91, 100].map(depthLabel)).toEqual([
      '2 in', '4 in', '8 in', '20 in', '28 in', '36 in', '40 in',
    ])
  })

  it('stageText', () => {
    expect(stageText(2, 'Leaf 2 fully extended')).toBe('2 – Leaf 2 fully extended')
    expect(stageText('V1 (Emergence)', null)).toBe('V1 (Emergence)')
    expect(stageText(0, 'Planted')).toBe('Planted')
    expect(stageText(null, null)).toBe('')
  })

  it('annual axis labels in plain words and units', () => {
    expect(annualAxisLabel('Total Precipitation [in]', true)).toBe('Cumulative rain (in)')
    expect(annualAxisLabel('Average Air Temperature @ 2 m [°F]', false)).toBe('Air temperature at 6.6 ft (°F)')
    expect(annualAxisLabel('Average Wind Speed @ 10 m [mi/hr]', false)).toBe('Wind at 33 ft (mph)')
  })

  it('fromSi inverts the data layer conversions', () => {
    expect(fromSi('°F')(0)).toBe(32)
    expect(fromSi('in')(25.4)).toBe(1)
    expect(fromSi('mi/h')(0.44704)).toBeCloseTo(1, 12)
    expect(fromSi('%')(42)).toBe(42)
    expect(fromSi('°F')(null)).toBeNull()
  })
})

describe('dropCappedDepths (SWP chart)', () => {
  // 1 bar = 100 kPa: the 1,000 bar cap is 100,000 kPa.
  const series = (cols: (number | null)[][]) =>
    ({
      depthsCm: cols.map((_, d) => [5, 10, 100][d]),
      time: cols[0].map((_, i) => `2026-07-0${i + 1}`),
      epochMs: cols[0].map((_, i) => i),
      kPa: cols,
      clipped: cols.map((c) => c.map(() => false)),
    }) as unknown as SwpSeries
  const capped = 200_000
  it('leaves out a depth on the cap for at least 90% of its readings, with a note', () => {
    const s = series([
      [50, 60, 70, 80, 90, 100, 110, 120, 130, 140],
      [...Array<number>(9).fill(capped), 500],
      Array<number>(10).fill(capped),
    ])
    const out = dropCappedDepths(s)
    expect(out.series.depthsCm).toEqual([5])
    expect(out.series.kPa).toEqual([s.kPa[0]])
    expect(out.series.clipped).toHaveLength(1)
    expect(out.notes).toEqual([
      '4 in: drier than -1,000 bar for nearly the whole period, so it is not drawn.',
      '40 in: drier than -1,000 bar for the whole period, so it is not drawn.',
    ])
  })
  it('keeps a depth under 90% on the cap, and one with no readings', () => {
    const s = series([[...Array<number>(8).fill(capped), 500, 500], Array<null>(10).fill(null)])
    expect(dropCappedDepths(s)).toEqual({ series: s, notes: [] })
    expect(SWP_CAPPED_SHARE).toBe(0.9)
  })
})
