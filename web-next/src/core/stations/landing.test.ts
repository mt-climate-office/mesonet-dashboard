import { describe, expect, it } from 'vitest'
import { landingLine, showsLanding, unknownStationNote } from './landing'

describe('showsLanding', () => {
  it.each([
    ['a first visit, the list loading', null, 'loading', null, true],
    ['a first visit, the list loaded', null, 'success', null, true],
    ['a first visit before the store starts', null, undefined, null, true],
    ['a confirmed station', 'acebozem', 'success', 'acebozem', false],
    ['a linked station while the list loads', 'acebozem', 'loading', null, false],
    ['a station the loaded list does not know', 'nosuch', 'success', null, true],
    ['the list failed (the sections show the error)', null, 'error', null, false],
  ] as const)('%s', (_, param, catalog, confirmed, want) => {
    expect(showsLanding(param, catalog, confirmed)).toBe(want)
  })
})

describe('landing text', () => {
  it('counts the stations once the list is in', () => {
    expect(landingLine(128)).toBe('Current conditions, trends and forecasts from 128 Montana Mesonet stations.')
    expect(landingLine(0)).toBe('Current conditions, trends and forecasts from Montana Mesonet stations.')
  })
  it('names an unknown station', () => {
    expect(unknownStationNote('nosuch')).toBe('There is no station “nosuch”. Choose another below.')
    expect(unknownStationNote(null)).toBe('')
  })
})
