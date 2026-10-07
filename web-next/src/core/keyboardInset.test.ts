import { describe, expect, it } from 'vitest'
import { KEYBOARD_MIN_PX, keyboardInset } from './keyboardInset'

describe('keyboardInset', () => {
  it('the keyboard height when the visual viewport shrinks', () => {
    expect(keyboardInset(800, 464, 0)).toBe(336)
  })
  it('a page panned up by iOS still measures from the visible bottom', () => {
    expect(keyboardInset(800, 464, 120)).toBe(216)
  })
  it('toolbar wobble and no keyboard are 0', () => {
    expect(keyboardInset(800, 800, 0)).toBe(0)
    expect(keyboardInset(800, 800 - KEYBOARD_MIN_PX + 1, 0)).toBe(0)
    expect(keyboardInset(800, 820, 0)).toBe(0)
  })
})
