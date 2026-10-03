import { describe, expect, it } from 'vitest'
import { annualAxisLabel, depthLabel, fromSi, stageText } from './labels'

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
