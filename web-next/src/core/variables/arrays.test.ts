import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { buildTimeseriesModel } from '../models/timeseries'
import { readUrlState } from '../url-schema'
import { ARRAY_CHIPS, ONE_ARRAY_NOTE, arraysNote, arraysPatch, offersArrays, splitsArrays } from './arrays'

const rows = (cols: Record<string, number>) => [{ station: 'a', datetime: '2026-07-01 00:00:00-06:00', ...cols }] as ObservationRow[]
const panel = (cols: Record<string, number>) => buildTimeseriesModel({ rows: rows(cols), vars: ['Soil VWC'], period: 'hourly', splitArrays: true })!.panels[0]

describe('the Arrays row', () => {
  it('is offered on soil depth variables only', () => {
    expect(['Soil VWC', 'Soil Temperature', 'Bulk EC'].every((name) => offersArrays({ name }))).toBe(true)
    expect(offersArrays({ name: 'Air Temperature' })).toBe(false)
    expect(offersArrays(undefined)).toBe(false)
  })
  it('splits on arrays=1, on a soil page only; Combined clears the key', () => {
    expect(ARRAY_CHIPS.map((c) => c.id)).toEqual(['combined', 'split'])
    expect(splitsArrays(readUrlState('?arrays=1'), { name: 'Soil VWC' })).toBe(true)
    expect(splitsArrays(readUrlState('?arrays=1'), { name: 'Air Temperature' })).toBe(false)
    expect(splitsArrays(readUrlState(''), { name: 'Soil VWC' })).toBe(false)
    expect(arraysPatch('split')).toEqual({ arrays: true })
    expect(arraysPatch('combined')).toEqual({ arrays: false })
  })
  it('says why Separate draws no array lines', () => {
    expect(arraysNote(true, panel({ 'Soil VWC @ 2 in [%]': 10 }))).toBe(ONE_ARRAY_NOTE)
    expect(arraysNote(true, panel({ 'Soil VWC @ 2 in (probe A) [%]': 10 }))).toBe('')
    expect(arraysNote(false, panel({ 'Soil VWC @ 2 in [%]': 10 }))).toBe('')
  })
})
