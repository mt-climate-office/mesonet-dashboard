import { describe, expect, it } from 'vitest'
import { annualAxisLabel, depthLabel, fromSi, insertGapsColumnar, stageText } from './labels'

// Ported from web/src/features/ag/figures/figures.test.ts (the renderer-free parts).
describe('Ag display helpers', () => {
  it('insertGapsColumnar breaks a line at a long step and is a no-op otherwise', () => {
    const e = [0, 1, 2, 3, 10, 11].map((h) => h * 3_600_000)
    const x = e.map(String)
    const out = insertGapsColumnar(e, x, [[1, 2, 3, 4, 5, 6]])
    expect(out.ys[0]).toEqual([1, 2, 3, 4, null, 5, 6])
    expect(out.x).toHaveLength(7)
    const even = insertGapsColumnar([0, 1, 2, 3], ['a', 'b', 'c', 'd'], [[1, null, 3, 4]])
    expect(even.ys[0]).toEqual([1, null, 3, 4])
  })

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

  it('annual axis labels follow legacy', () => {
    expect(annualAxisLabel('Total Precipitation [in]', true)).toBe('Annual Cumulative Precipitation [in]')
    expect(annualAxisLabel('Average Air Temperature @ 2 m [°F]', false)).toBe('Air Temperature @ 2 m [°F]')
  })

  it('fromSi inverts the data layer conversions', () => {
    expect(fromSi('°F')(0)).toBe(32)
    expect(fromSi('in')(25.4)).toBe(1)
    expect(fromSi('mi/h')(0.44704)).toBeCloseTo(1, 12)
    expect(fromSi('%')(42)).toBe(42)
    expect(fromSi('°F')(null)).toBeNull()
  })
})
