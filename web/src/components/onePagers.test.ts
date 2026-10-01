import { describe, expect, it } from 'vitest'
import { findOnePager, parseOnePagers } from './onePagers'

describe('one-pagers', () => {
  const list = parseOnePagers([
    { station: 'acechest', url: 'https://v5.airtableusercontent.com/a' },
    { station: 'acecarte', url: 'https://v5.airtableusercontent.com/b' },
    { station: 'acecarte', url: 'https://v5.airtableusercontent.com/c' },
    { station: 'bad', url: 'javascript:alert(1)' },
    { station: 1, url: 'https://x' },
    null,
  ])

  it('keeps only well-formed http(s) entries', () => {
    expect(list.map((p) => p.station)).toEqual(['acechest', 'acecarte', 'acecarte'])
    expect(parseOnePagers({})).toEqual([])
  })
  it('finds the first entry for a station', () => {
    expect(findOnePager(list, 'acecarte')).toBe('https://v5.airtableusercontent.com/b')
    expect(findOnePager(list, 'nope')).toBeNull()
    expect(findOnePager(undefined, 'acecarte')).toBeNull()
  })
})
