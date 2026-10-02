import { describe, expect, it } from 'vitest'
import { isTheme, nextTheme, themeToggleLabel } from './theme'

describe('theme cycle', () => {
  it('cycles dark → light → high-contrast → dark', () => {
    expect(nextTheme('dark')).toBe('light')
    expect(nextTheme('light')).toBe('high-contrast')
    expect(nextTheme('high-contrast')).toBe('dark')
    expect(nextTheme('sepia')).toBe('dark')
  })
  it('labels the target theme', () => {
    expect(themeToggleLabel('dark')).toBe('Switch to light theme')
    expect(themeToggleLabel('high-contrast')).toBe('Switch to dark theme')
  })
  it('validates theme names', () => {
    expect(isTheme('light')).toBe(true)
    expect(isTheme('Light')).toBe(false)
  })
})
