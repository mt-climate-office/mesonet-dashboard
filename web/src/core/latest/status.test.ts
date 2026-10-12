import { describe, expect, it } from 'vitest'
import { NO_DATA_TITLE } from '../models/timeseries'
import { dataSettled, plotStatus } from './status'

const base = { empty: null, waiting: false, record: 'success' as const, hasModel: true }

describe('plotStatus', () => {
  it('shows empty states first', () => {
    expect(plotStatus({ ...base, empty: { kind: 'no-vars', title: 'No variables selected' } })).toEqual({ kind: 'empty', title: 'No variables selected', hint: undefined })
  })
  it('loads while inputs or the record load, keeping a drawable plot', () => {
    expect(plotStatus({ ...base, record: null, waiting: true, hasModel: false }).kind).toBe('loading')
    expect(plotStatus({ ...base, record: 'loading', hasModel: false }).kind).toBe('loading')
    expect(plotStatus({ ...base, record: 'loading' }).kind).toBe('ready')
  })
  it('shows the error state when the record or the element list failed, not "no data"', () => {
    expect(plotStatus({ ...base, record: 'error', hasModel: false })).toEqual({ kind: 'error' })
    expect(plotStatus({ ...base, record: null, waiting: false, hasModel: false, failed: true })).toEqual({ kind: 'error' })
    expect(plotStatus({ ...base, failed: true, empty: { kind: 'no-vars', title: 'No variables selected' } }).kind).toBe('empty')
  })
  it('shows no data for no request or no rows (never loads forever)', () => {
    for (const s of [{ record: null }, { hasModel: false }] as const) {
      const r = plotStatus({ ...base, ...s })
      expect(r.kind === 'empty' && r.title).toBe(NO_DATA_TITLE)
    }
    expect(plotStatus(base).kind).toBe('ready')
  })
})

describe('dataSettled', () => {
  it('only once the current request has loaded a model (not the previous window kept while loading)', () => {
    expect(dataSettled({ record: 'success', hasModel: true })).toBe(true)
    expect(dataSettled({ record: 'loading', hasModel: true })).toBe(false)
    expect(dataSettled({ record: 'success', hasModel: false })).toBe(false)
    expect(dataSettled({ record: 'error', hasModel: false })).toBe(false)
    expect(dataSettled({ record: null, hasModel: false })).toBe(false)
  })
})
