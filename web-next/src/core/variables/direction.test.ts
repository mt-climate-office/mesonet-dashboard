import { describe, expect, it } from 'vitest'
import { circularMean } from './direction'

describe('circularMean', () => {
  it('averages bearings as vectors: across north, and with nulls skipped', () => {
    expect(circularMean([350, 10])).toEqual({ deg: 0, strength: expect.closeTo(0.985, 3) })
    expect(circularMean([90, null, 90])).toEqual({ deg: 90, strength: 1 })
    expect(circularMean([270, 180])?.deg).toBeCloseTo(225, 6)
  })
  it('strength near 0 when bearings cancel; null without values', () => {
    expect(circularMean([0, 90, 180, 270])?.strength).toBeCloseTo(0, 9)
    expect(circularMean([null])).toBeNull()
    expect(circularMean([])).toBeNull()
  })
})
