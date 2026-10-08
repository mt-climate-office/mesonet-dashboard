import { describe, expect, it } from 'vitest'
import { breakWraps, compassTick } from './windDirection'

describe('wind direction on a chart', () => {
  it('compass ticks at the cardinal points, degrees elsewhere', () => {
    expect([0, 90, 180, 270, 360].map(compassTick)).toEqual(['N', 'E', 'S', 'W', 'N'])
    expect(compassTick(45)).toBe('45°')
  })
  it('breaks the line where it wraps through north, not on a turn of 180° or less', () => {
    expect(breakWraps([[0, 350], [10, 10], [20, 190], [30, null], [40, 20]])).toEqual([[0, 350], [5, null], [10, 10], [20, 190], [30, null], [40, 20]])
  })
})
