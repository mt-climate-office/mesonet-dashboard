// Tests for threshold slider snapping, ordering and the "none" stop.

import { describe, expect, it } from 'vitest'
import {
  highSliderMax,
  highToSlider,
  normalizeRange,
  sliderToHigh,
  snap,
  valueText,
  withHigh,
  withLow,
  type RangeConfig,
} from './rangeModel'

const gdd: RangeConfig = { min: 32, max: 100, step: 1, allowNone: true }
const capped: RangeConfig = { ...gdd, allowNone: false }

describe('snap', () => {
  it('rounds to the step from min and clamps', () => {
    expect(snap(50.4, gdd)).toBe(50)
    expect(snap(10, gdd)).toBe(32)
    expect(snap(140, gdd)).toBe(100)
    expect(snap(0.3, { min: 0, max: 1, step: 0.1, allowNone: false })).toBe(0.3)
    expect(snap(37, { min: 32, max: 100, step: 5, allowNone: false })).toBe(37)
    expect(snap(39, { min: 32, max: 100, step: 5, allowNone: false })).toBe(37)
  })
})

describe('none stop', () => {
  it('adds one step past max only when allowed', () => {
    expect(highSliderMax(gdd)).toBe(101)
    expect(highSliderMax(capped)).toBe(100)
  })

  it('maps null to the stop and back', () => {
    expect(highToSlider(null, gdd)).toBe(101)
    expect(highToSlider(86, gdd)).toBe(86)
    expect(sliderToHigh(101, gdd)).toBeNull()
    expect(sliderToHigh(100, gdd)).toBe(100)
    expect(sliderToHigh(101, capped)).toBe(100)
  })
})

describe('withLow / withHigh', () => {
  it('keeps low at least one step below high', () => {
    expect(withLow({ low: 50, high: 86 }, 90, gdd)).toEqual({ low: 85, high: 86 })
    expect(withLow({ low: 50, high: 86 }, 40, gdd)).toEqual({ low: 40, high: 86 })
    expect(withLow({ low: 50, high: null }, 100, gdd)).toEqual({ low: 100, high: null })
  })

  it('keeps high at least one step above low, and allows the none stop', () => {
    expect(withHigh({ low: 50, high: 86 }, 45, gdd)).toEqual({ low: 50, high: 51 })
    expect(withHigh({ low: 50, high: 86 }, 101, gdd)).toEqual({ low: 50, high: null })
    expect(withHigh({ low: 100, high: null }, 60, gdd)).toEqual({ low: 100, high: 100 })
  })
})

describe('normalizeRange', () => {
  it('snaps, orders and drops a disallowed null', () => {
    expect(normalizeRange({ low: 50.2, high: 86.4 }, gdd)).toEqual({ low: 50, high: 86 })
    expect(normalizeRange({ low: 90, high: 60 }, gdd)).toEqual({ low: 59, high: 60 })
    expect(normalizeRange({ low: 50, high: null }, gdd)).toEqual({ low: 50, high: null })
    expect(normalizeRange({ low: 50, high: null }, capped)).toEqual({ low: 50, high: 100 })
  })
})

describe('valueText', () => {
  it('formats values and the none stop', () => {
    expect(valueText(50, '°F')).toBe('50 °F')
    expect(valueText(50, '')).toBe('50')
    expect(valueText(null, '°F')).toBe('No upper limit')
  })
})
