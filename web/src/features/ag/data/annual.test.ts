import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAnnualDaily, parseAnnualYear } from './annual'
import { parseCsvRaw } from './parse'

describe('parseAnnualYear', () => {
  it('fills a full calendar year and converts to SI', () => {
    const rows = parseCsvRaw(
      [
        'station,datetime,Total Precipitation [in],provisional',
        'x,2026-01-01 00:00:00-07:00,1,False',
        'x,2026-01-03 00:00:00-07:00,0.5,True',
      ].join('\n'),
    )
    const y = parseAnnualYear(rows, 2026)
    expect(y.date).toHaveLength(365)
    expect(y.date.slice(0, 4)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
    expect(y.date.at(-1)).toBe('2026-12-31')
    expect(y.value.slice(0, 4)).toEqual([25.4, null, 12.7, null])
    expect(y.value.slice(4).every((v) => v === null)).toBe(true)
    expect(y.provisional.slice(0, 4)).toEqual([false, false, true, false])
    expect(parseAnnualYear([], 2024).date).toHaveLength(366)
  })
})

describe('getAnnualDaily', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('returns a full all-null year for a future year without requesting it', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (u: string) => {
      calls.push(u)
      return new Response('station,datetime,Average Air Temperature @ 2 m [°F],provisional\nx,2026-01-01 00:00:00-07:00,32,False\n', { status: 200 })
    })
    const r = await getAnnualDaily('acebozem', 'air_temp', [2027, 2026], { today: '2026-10-01' })
    expect(r.years.map((y) => y.year)).toEqual([2026, 2027])
    expect(calls).toHaveLength(1)
    expect(r.years[0].date).toHaveLength(365)
    expect(r.years[0].value[0]).toBe(0)
    expect(r.years[1].date).toHaveLength(365)
    expect(r.years[1].value.every((v) => v === null)).toBe(true)
  })
})
