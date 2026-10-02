import { describe, expect, it } from 'vitest'
import { NO_DATA_TITLE } from '../models/timeseries'
import { plotStatus } from './status'

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
  it('shows no data for no request, an error or no rows (never loads forever)', () => {
    for (const s of [{ record: null }, { record: 'error' }, { hasModel: false }] as const) {
      const r = plotStatus({ ...base, ...s })
      expect(r.kind === 'empty' && r.title).toBe(NO_DATA_TITLE)
    }
    expect(plotStatus(base).kind).toBe('ready')
  })
})
