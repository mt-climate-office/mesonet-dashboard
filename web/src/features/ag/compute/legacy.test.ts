import { describe, expect, it } from 'vitest'
import { CCI_RISK_COLORS } from '@/lib/params'
import { classifyCci, methodBGdd } from './legacy'

describe('methodBGdd', () => {
  it('averages and subtracts the base', () => {
    expect(methodBGdd(50, 70, 32, 95)).toBe(28)
  })
  it('floors Tmin at the base', () => {
    // (32 + 60) / 2 - 32 = 14
    expect(methodBGdd(20, 60, 32, 95)).toBe(14)
  })
  it('caps Tmax at the upper threshold', () => {
    // corn 50/86: (60 + 86) / 2 - 50 = 23
    expect(methodBGdd(60, 100, 50, 86)).toBe(23)
  })
  it('never goes negative', () => {
    expect(methodBGdd(10, 20, 32, 95)).toBe(0)
  })
})

describe('classifyCci', () => {
  it.each([
    [113, 'Extreme Danger'],
    [105, 'Extreme'],
    [96, 'Severe'],
    [87, 'Moderate'],
    [77, 'Mild'],
    [76.9, 'No Stress'],
    [33, 'No Stress'],
    [32.9, 'Mild'],
    [14, 'Mild'],
    [-4, 'Moderate'],
    [-22, 'Severe'],
    [-40, 'Extreme'],
    [-40.1, 'Extreme Danger'],
  ])('adult %d → %s', (v, cls) => {
    expect(classifyCci(v, false)).toBe(cls)
  })

  it.each([
    [42, 'No Stress'],
    [41.9, 'Mild'],
    [32, 'Mild'],
    [23, 'Moderate'],
    [14, 'Severe'],
    [5, 'Extreme'],
    [4.9, 'Extreme Danger'],
    [100, 'Severe'],
  ])('newborn %d → %s', (v, cls) => {
    expect(classifyCci(v, true)).toBe(cls)
  })

  it('every class has a color', () => {
    for (const v of [120, 100, 90, 80, 50, 20, 0, -30, -50]) {
      expect(CCI_RISK_COLORS[classifyCci(v, false)]).toBeDefined()
      expect(CCI_RISK_COLORS[classifyCci(v, true)]).toBeDefined()
    }
  })
})
