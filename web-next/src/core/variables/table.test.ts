import { describe, expect, it } from 'vitest'
import { tablePage } from './table'

const rows = Array.from({ length: 120 }, (_, i) => [String(i)])

describe('tablePage', () => {
  it('pages newest first', () => {
    const p = tablePage(rows, 1)
    expect(p).toMatchObject({ page: 1, pages: 3, summary: 'Rows 1–50 of 120' })
    expect(p.rows[0]).toEqual(['119'])
    expect(tablePage(rows, 3)).toMatchObject({ summary: 'Rows 101–120 of 120' })
    expect(tablePage(rows, 3).rows.at(-1)).toEqual(['0'])
  })
  it('clamps the page and handles no rows', () => {
    expect(tablePage(rows, 9).page).toBe(3)
    expect(tablePage(rows, 0).page).toBe(1)
    expect(tablePage([], 1)).toEqual({ rows: [], page: 1, pages: 1, summary: 'No rows' })
  })
})
