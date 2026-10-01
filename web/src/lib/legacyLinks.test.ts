import { describe, expect, it } from 'vitest'
import { legacyStateHash, legacyStateUrl } from './legacyLinks'

describe('legacyStateHash', () => {
  it('reads the state hash', () => {
    expect(legacyStateHash('?state=abcd1234')).toBe('abcd1234')
    expect(legacyStateHash('s=aceabsar&state=abcd1234')).toBe('abcd1234')
  })
  it('ignores missing or blank values', () => {
    expect(legacyStateHash('?s=aceabsar')).toBeNull()
    expect(legacyStateHash('?state=')).toBeNull()
    expect(legacyStateHash('?state=%20')).toBeNull()
    expect(legacyStateHash('')).toBeNull()
  })
})

describe('legacyStateUrl', () => {
  it('builds the legacy share URL', () => {
    expect(legacyStateUrl('https://mesonet.climate.umt.edu/dash', 'abcd1234')).toBe(
      'https://mesonet.climate.umt.edu/dash/?state=abcd1234',
    )
    expect(legacyStateUrl('https://x/dash/', 'a b')).toBe('https://x/dash/?state=a%20b')
  })
})
