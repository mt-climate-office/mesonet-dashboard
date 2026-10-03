import { describe, expect, it } from 'vitest'
import {
  BAD_DATES,
  dateRangeLabel,
  formBlocker,
  NO_ROWS,
  NO_STATION,
  NO_VARIABLES,
  primaryAction,
  queryKey,
  stationLine,
  variablesSummary,
} from './form'

describe('summary row values', () => {
  it('stationLine', () => {
    expect(stationLine('Bozeman', 'acebozem')).toBe('Bozeman (acebozem)')
    expect(stationLine(undefined, 'acebozem')).toBe('acebozem')
    expect(stationLine(undefined, null)).toBe('None')
  })
  it('variablesSummary shows two names, then a count', () => {
    expect(variablesSummary([])).toBe('None')
    expect(variablesSummary(['Air Temperature'])).toBe('Air Temperature')
    expect(variablesSummary(['A', 'B'])).toBe('A, B')
    expect(variablesSummary(['A', 'B', 'C', 'D'])).toBe('A, B + 2 more')
  })
  it('dateRangeLabel names the year once when it is shared', () => {
    expect(dateRangeLabel('2026-09-01', '2026-09-30')).toBe('Sep 1 – Sep 30, 2026')
    expect(dateRangeLabel('2025-10-02', '2026-01-05')).toBe('Oct 2, 2025 – Jan 5, 2026')
  })
})

describe('formBlocker', () => {
  const ok = { station: 'acebozem', elements: ['air_temp'], dateError: null, rangeValid: true }
  it('reports the first thing to fix', () => {
    expect(formBlocker(ok)).toBeNull()
    expect(formBlocker({ ...ok, station: null, elements: [] })).toBe(NO_STATION)
    expect(formBlocker({ ...ok, elements: [] })).toBe(NO_VARIABLES)
    expect(formBlocker({ ...ok, dateError: 'Start is after end.', rangeValid: false })).toBe('Start is after end.')
    expect(formBlocker({ ...ok, rangeValid: false })).toBe(BAD_DATES)
  })
})

describe('queryKey', () => {
  it('changes with every input of the request', () => {
    const q = { station: 's', start: '2026-09-01', end: '2026-09-30', period: 'daily' as const, elements: ['a', 'b'], level: 2 as const }
    const k = queryKey(q)
    expect(queryKey({ ...q })).toBe(k)
    for (const patch of [{ station: 't' }, { start: '2026-09-02' }, { end: '2026-09-29' }, { period: 'hourly' as const }, { elements: ['a'] }, { level: 1 as const }])
      expect(queryKey({ ...q, ...patch })).not.toBe(k)
  })
})

describe('primaryAction', () => {
  const base = { blocker: null, waiting: false, loading: false, armed: false, rows: null }
  it('previews until the current inputs have a result', () => {
    expect(primaryAction(base)).toEqual({ kind: 'preview', label: 'Preview', disabled: false, busy: false, reason: null })
    expect(primaryAction({ ...base, armed: true }).label).toBe('Confirm large request')
    expect(primaryAction({ ...base, waiting: true })).toMatchObject({ kind: 'preview', disabled: true, reason: null })
    expect(primaryAction({ ...base, blocker: NO_VARIABLES })).toEqual({ kind: 'preview', label: 'Preview', disabled: true, busy: false, reason: NO_VARIABLES })
    expect(primaryAction({ ...base, loading: true })).toEqual({ kind: 'preview', label: 'Loading preview…', disabled: true, busy: true, reason: null })
  })
  it('then downloads, labelled with the row count', () => {
    expect(primaryAction({ ...base, rows: 1234 })).toEqual({ kind: 'download', label: 'Download CSV · 1,234 rows', disabled: false, busy: false, reason: null })
    expect(primaryAction({ ...base, rows: 1 }).label).toBe('Download CSV · 1 row')
    expect(primaryAction({ ...base, rows: 0 })).toEqual({ kind: 'download', label: 'Download CSV · 0 rows', disabled: true, busy: false, reason: NO_ROWS })
  })
})
