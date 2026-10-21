import { describe, expect, it } from 'vitest'
import { adoptSavedUnits, cutoffInUnits, parseGddCutoffs, sliderBounds, sliderWrites, toSlider, toggleUnitsPatch } from './gddCutoffs'

describe('GDD cutoffs in SI', () => {
  it('reads URL cutoffs in °C into °F state', () => {
    const c = parseGddCutoffs('corn', '10', '35', 'si')
    // 10 °C is corn's own base (50 °F): not custom.
    expect(c.loF).toBeNull()
    expect(c.hiF).toBeCloseTo(95)
    expect(c.custom).toBe(true)
  })
  it('range-checks in the display units', () => {
    expect(sliderBounds('si')).toEqual({ min: -1, max: 38, none: 39 })
    expect(parseGddCutoffs('corn', '45', null, 'si').strip.lo).toBe(true)
    expect(parseGddCutoffs('corn', '45', null, 'us').loF).toBe(45)
  })
  it('the legacy-default strip applies to US links only', () => {
    expect(parseGddCutoffs('corn', '50', '86', 'us').strip).toEqual({ lo: true, hi: true })
  })
  it('slider positions and writes are whole °C', () => {
    expect(cutoffInUnits(50, 'si')).toBe(10)
    expect(toSlider(95, 'si')).toBe(35)
    expect(toSlider(Infinity, 'si')).toBe(39)
    expect(sliderWrites('corn', [10, 30], [12, 30], 'si')).toEqual({ lo: '12' })
    expect(sliderWrites('corn', [12, 30], [10, 30], 'si')).toEqual({ lo: null })
    expect(sliderWrites('corn', [10, 30], [10, 39], 'si')).toEqual({ hi: 'none' })
  })
})

describe('toggleUnitsPatch', () => {
  it('converts custom cutoffs with the switch; none and absent keys stay', () => {
    expect(toggleUnitsPatch({ units: 'us', gdd_lo: '50', gdd_hi: 'none' }, 'si')).toEqual({ units: 'si', gdd_lo: '10', gdd_hi: 'none' })
    expect(toggleUnitsPatch({ units: 'si', gdd_lo: '10', gdd_hi: null }, 'us')).toEqual({ units: 'us', gdd_lo: '50' })
    expect(toggleUnitsPatch({ units: 'us', gdd_lo: null, gdd_hi: null }, 'si')).toEqual({ units: 'si' })
  })
})

describe('adoptSavedUnits', () => {
  it('opens a US link in the saved SI, converting its cutoffs', () => {
    expect(adoptSavedUnits('?s=acebozem&v=gdd&gdd_lo=50&gdd_hi=none', 'si')).toBe('?s=acebozem&v=gdd&gdd_lo=10&gdd_hi=none&units=si')
    expect(adoptSavedUnits('?s=acebozem', 'si')).toBe('?s=acebozem&units=si')
  })
  it('leaves links that name their units, and US or no saved choice, alone', () => {
    expect(adoptSavedUnits('?units=us&gdd_lo=50', 'si')).toBeNull()
    expect(adoptSavedUnits('?gdd_lo=50', 'us')).toBeNull()
    expect(adoptSavedUnits('?gdd_lo=50', null)).toBeNull()
  })
})
