import { describe, expect, it } from 'vitest'
import { parseAnnualYear } from './annual'
import { parseCsvRaw } from './parse'

describe('parseAnnualYear', () => {
  it('fills a full calendar year, converts to SI, clips at today', () => {
    const rows = parseCsvRaw(
      [
        'station,datetime,Total Precipitation [in],provisional',
        'x,2026-01-01 00:00:00-07:00,1,False',
        'x,2026-01-03 00:00:00-07:00,0.5,True',
      ].join('\n'),
    )
    const y = parseAnnualYear(rows, 2026, '2026-01-04')
    expect(y.date).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
    expect(y.value).toEqual([25.4, null, 12.7, null])
    expect(y.provisional).toEqual([false, false, true, false])
    expect(parseAnnualYear([], 2024).date).toHaveLength(366)
  })
})
