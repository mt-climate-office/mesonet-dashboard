import { describe, expect, it } from 'vitest'
import { swipeStep } from './swipe'

describe('swipeStep', () => {
  it('left is next, right is previous', () => {
    expect(swipeStep(-80, 10)).toBe(1)
    expect(swipeStep(90, -5)).toBe(-1)
  })
  it('short, or more vertical than twice sideways, is not a swipe', () => {
    expect(swipeStep(-50, 0)).toBe(0)
    expect(swipeStep(-100, 60)).toBe(0)
    expect(swipeStep(0, 300)).toBe(0)
  })
})
