import { describe, expect, it } from 'vitest'
import { CHOOSE_STATION, headerName } from './header'

describe('headerName', () => {
  it.each([
    ['the name once confirmed', 'Bozeman', true, false, 'Bozeman'],
    ['the name even while a refetch loads', 'Bozeman', true, true, 'Bozeman'],
    ['blank while a ?s= link resolves', undefined, true, true, ''],
    ['choose after a ?s= link fails to resolve', undefined, true, false, CHOOSE_STATION],
    ['choose with no ?s=, loading or not', undefined, false, true, CHOOSE_STATION],
  ] as const)('%s', (_, name, linked, loading, want) => {
    expect(headerName(name, linked, loading)).toBe(want)
  })
})
