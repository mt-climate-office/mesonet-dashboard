// Tests for the multiselect's filtering, group state and labels, and the
// shared order-stable selection helpers.

import { describe, expect, it } from 'vitest'
import { filterGroups, groupState, labelFor, optionValues, type MultiselectGroup } from './multiselectModel'
import { inOrder, setIn, toggleIn } from './selectionModel'

const groups: MultiselectGroup[] = [
  {
    id: 'standard',
    label: 'Standard elements',
    options: [
      { value: 'air_temp', label: 'Air Temperature' },
      { value: 'ppt', label: 'Precipitation' },
      { value: 'wind_spd', label: 'Wind Speed' },
    ],
  },
  {
    id: 'derived',
    label: 'Derived variables',
    options: [
      { value: 'etr', label: 'Reference ET' },
      { value: 'feels_like', label: 'Feels-like Temperature' },
    ],
  },
]
const order = optionValues(groups)

describe('filterGroups', () => {
  it('filters options by label or value and drops empty groups', () => {
    const r = filterGroups(groups, 'TEMP')
    expect(r.map((g) => g.id)).toEqual(['standard', 'derived'])
    expect(r[0].options.map((o) => o.value)).toEqual(['air_temp'])
    expect(filterGroups(groups, 'etr').map((g) => g.id)).toEqual(['derived'])
    expect(filterGroups(groups, 'nothing')).toEqual([])
  })

  it('returns every group for a blank query', () => {
    expect(filterGroups(groups, '  ')).toEqual(groups)
  })
})

describe('groupState', () => {
  it('is none, some or all', () => {
    const values = ['a', 'b']
    expect(groupState(values, [])).toBe('none')
    expect(groupState(values, ['b', 'x'])).toBe('some')
    expect(groupState(values, ['a', 'b'])).toBe('all')
    expect(groupState([], ['a'])).toBe('none')
  })
})

describe('labelFor', () => {
  it('finds labels across groups and falls back to the value', () => {
    expect(labelFor('etr', groups)).toBe('Reference ET')
    expect(labelFor('unknown', groups)).toBe('unknown')
  })
})

describe('selection helpers', () => {
  it('inOrder follows option order, dedupes and puts unknowns last', () => {
    expect(inOrder(['etr', 'zzz', 'air_temp', 'etr'], order)).toEqual(['air_temp', 'etr', 'zzz'])
  })

  it('toggleIn adds and removes in option order', () => {
    expect(toggleIn(['etr'], 'ppt', order)).toEqual(['ppt', 'etr'])
    expect(toggleIn(['ppt', 'etr'], 'ppt', order)).toEqual(['etr'])
  })

  it('setIn adds or removes a whole group', () => {
    expect(setIn(['etr'], ['air_temp', 'ppt', 'wind_spd'], true, order)).toEqual(['air_temp', 'ppt', 'wind_spd', 'etr'])
    expect(setIn(['air_temp', 'etr'], ['air_temp', 'ppt'], false, order)).toEqual(['etr'])
  })
})
