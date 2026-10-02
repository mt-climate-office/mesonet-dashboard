import { describe, expect, it } from 'vitest'
import { legacyStateHash, legacyStateUrl, withoutLegacyState } from './legacyLinks'

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

describe('withoutLegacyState', () => {
  it('drops state and keeps the rest verbatim', () => {
    expect(withoutLegacyState('?state=abcd1234&s=acebozem')).toBe('?s=acebozem')
    expect(withoutLegacyState('?s=acebozem&state=x&vars=air_temp,ppt&q=a+b')).toBe(
      '?s=acebozem&vars=air_temp,ppt&q=a+b',
    )
    expect(withoutLegacyState('?%73tate=x&s=a')).toBe('?s=a')
  })
  it('returns empty when nothing is left', () => {
    expect(withoutLegacyState('?state=abcd1234')).toBe('')
    expect(withoutLegacyState('')).toBe('')
    expect(withoutLegacyState('?')).toBe('')
  })
  it('keeps keys that only look like state, or do not decode', () => {
    expect(withoutLegacyState('?states=1&xstate=2')).toBe('?states=1&xstate=2')
    expect(withoutLegacyState('?%E0%A4%A=1')).toBe('?%E0%A4%A=1')
  })
})
