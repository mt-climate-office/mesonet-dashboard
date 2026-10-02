// Tests for the combobox's pure filter, ranking, grouping and key stepping.

import { describe, expect, it } from 'vitest'
import { filterItems, matchRank, resultSummary, stepIndex, type ComboboxItem } from './comboboxModel'

const items: ComboboxItem[] = [
  { id: 'aceabsar', label: 'Absarokee', group: 'HydroMet', keywords: ['ABSM8'] },
  { id: 'acebozem', label: 'Bozeman Airport', group: 'HydroMet' },
  { id: 'agrbozem', label: 'Bozeman', group: 'AgriMet', keywords: ['BOZM8'] },
  { id: 'coopmoz', label: 'Mozart Ranch', group: 'Cooperator' },
  { id: 'acemozem', label: 'West Mozem', group: 'HydroMet' },
]

describe('matchRank', () => {
  it('ranks exact, prefix and substring matches on label, id and keywords', () => {
    const [absarokee, bozemanAirport, bozeman] = items
    expect(matchRank(bozeman, 'bozeman')).toBe(0)
    expect(matchRank(absarokee, 'absm8')).toBe(0)
    expect(matchRank(bozemanAirport, 'bozeman')).toBe(1)
    expect(matchRank(bozemanAirport, 'acebo')).toBe(2)
    expect(matchRank(bozemanAirport, 'airport')).toBe(3)
    expect(matchRank(bozeman, 'zm8')).toBe(4)
    expect(matchRank(bozeman, 'xyz')).toBe(Infinity)
  })

  it('ranks everything 0 for an empty query', () => {
    expect(matchRank(items[0], '')).toBe(0)
  })
})

describe('filterItems', () => {
  it('is case-insensitive and trims the query', () => {
    expect(filterItems(items, '  BOZEMAN ').flat.map((i) => i.id)).toEqual(['acebozem', 'agrbozem'])
  })

  it('points best at the top-ranked match even in a later group', () => {
    const r = filterItems(items, 'bozeman')
    expect(r.flat[r.best].id).toBe('agrbozem')
    expect(filterItems(items, '').best).toBe(0)
  })

  it('matches NWSLI ids given as keywords', () => {
    expect(filterItems(items, 'bozm8').flat.map((i) => i.id)).toEqual(['agrbozem'])
  })

  it('keeps group first-appearance order and sorts by rank within a group', () => {
    const r = filterItems(items, 'moz')
    expect(r.groups.map((g) => g.name)).toEqual(['HydroMet', 'Cooperator'])
    // HydroMet: "West Mozem" (label substring, 3) — the only HydroMet match.
    expect(r.flat.map((i) => i.id)).toEqual(['acemozem', 'coopmoz'])
  })

  it('returns all items in group order for an empty query', () => {
    const r = filterItems(items, '')
    expect(r.flat.map((i) => i.id)).toEqual(['aceabsar', 'acebozem', 'acemozem', 'agrbozem', 'coopmoz'])
    expect(r.total).toBe(5)
  })

  it('truncates to the limit but reports the full total', () => {
    const r = filterItems(items, '', 2)
    expect(r.flat).toHaveLength(2)
    expect(r.total).toBe(5)
    expect(r.groups).toEqual([{ name: 'HydroMet', items: [items[0], items[1]] }])
  })

  it('puts ungrouped items in a group named null', () => {
    const r = filterItems([{ id: 'a', label: 'A' }], '')
    expect(r.groups).toEqual([{ name: null, items: [{ id: 'a', label: 'A' }] }])
  })

  it('returns an empty result when nothing matches', () => {
    expect(filterItems(items, 'zzz')).toEqual({ groups: [], flat: [], total: 0, best: -1 })
  })
})

describe('stepIndex', () => {
  it('wraps Up and Down', () => {
    expect(stepIndex(-1, 'ArrowDown', 3)).toBe(0)
    expect(stepIndex(2, 'ArrowDown', 3)).toBe(0)
    expect(stepIndex(0, 'ArrowUp', 3)).toBe(2)
    expect(stepIndex(-1, 'ArrowUp', 3)).toBe(2)
    expect(stepIndex(1, 'ArrowUp', 3)).toBe(0)
  })

  it('jumps with Home and End and ignores other keys', () => {
    expect(stepIndex(1, 'Home', 3)).toBe(0)
    expect(stepIndex(1, 'End', 3)).toBe(2)
    expect(stepIndex(1, 'a', 3)).toBe(1)
  })

  it('returns -1 with no options', () => {
    expect(stepIndex(0, 'ArrowDown', 0)).toBe(-1)
  })
})

describe('resultSummary', () => {
  it('describes empty, singular, plural and truncated results', () => {
    expect(resultSummary(0, 0)).toBe('No results')
    expect(resultSummary(1, 1)).toBe('1 result')
    expect(resultSummary(4, 4)).toBe('4 results')
    expect(resultSummary(200, 512)).toBe('Showing 200 of 512 results; type to narrow')
  })
})
