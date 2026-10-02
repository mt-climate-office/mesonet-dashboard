import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  daySpan,
  derivedOptionsFor,
  SWP_CODES,
  downloadFilename,
  fetchDownload,
  orderColumns,
  outerJoin,
  splitElements,
} from './request'
import { elementLabel } from './labels'
import { toCsv } from '../csv'

const M = 'Contains Missing Data'

describe('downloadFilename', () => {
  it('matches the legacy pattern', () => {
    expect(downloadFilename('acebozem', 'monthly', '2024-01-05', '2026-09-30')).toBe(
      'acebozem_monthly_20240105_to_20260930.csv',
    )
  })
})

describe('splitElements', () => {
  it('separates derived variables', () => {
    expect(splitElements(['air_temp_0200', 'etr', 'ppt', 'cci'])).toEqual({
      std: ['air_temp_0200', 'ppt'],
      derived: ['etr', 'cci'],
    })
  })
})

describe('SWP-only derived variables', () => {
  it('treats swp / percent_saturation as derived (old links keep working)', () => {
    expect(splitElements(['swp', 'percent_saturation', 'ppt'])).toEqual({
      std: ['ppt'],
      derived: ['swp', 'percent_saturation'],
    })
  })
  it('offers them only at has_swp stations', () => {
    expect(derivedOptionsFor(false).map((o) => o.value)).toEqual(['feels_like', 'etr', 'cci'])
    expect(derivedOptionsFor(true).map((o) => o.value)).toEqual([
      'feels_like',
      'etr',
      'cci',
      'swp',
      'percent_saturation',
    ])
    expect([...SWP_CODES]).toEqual(['swp', 'percent_saturation'])
  })
})

describe('daySpan', () => {
  it('counts inclusive days', () => {
    expect(daySpan('2026-09-01', '2026-09-01')).toBe(1)
    expect(daySpan('2026-09-02', '2026-10-01')).toBe(30)
    expect(daySpan('2024-01-01', '2024-12-31')).toBe(366)
  })
})

describe('outerJoin', () => {
  const a = [
    { station: 's', datetime: '2026-09-01 00:00:00-06:00', x: 1, [M]: false, provisional: false },
    { station: 's', datetime: '2026-09-02 00:00:00-06:00', x: 2, [M]: false, provisional: false },
  ]
  const b = [
    { station: 's', datetime: '2026-09-02 00:00:00-06:00', y: 20, [M]: true },
    { station: 's', datetime: '2026-09-03 00:00:00-06:00', y: 30, [M]: false },
  ]
  it('keeps rows from both sides, sorted, ORing flags', () => {
    const out = outerJoin(a, b)
    expect(out.map((r) => r.datetime)).toEqual([
      '2026-09-01 00:00:00-06:00',
      '2026-09-02 00:00:00-06:00',
      '2026-09-03 00:00:00-06:00',
    ])
    expect(out[1]).toMatchObject({ x: 2, y: 20, [M]: true, provisional: false })
    expect(out[2]).toMatchObject({ y: 30, [M]: false })
  })
  it('passes through when one side is empty', () => {
    expect(outerJoin([], b)).toBe(b)
    expect(outerJoin(a, [])).toBe(a)
  })
})

describe('orderColumns', () => {
  it('puts station/datetime first and flags last', () => {
    expect(
      orderColumns([
        { provisional: false, [M]: false, datetime: 'd', station: 's', a: 1 },
        { b: 2, obs_count: 3 },
      ]),
    ).toEqual(['station', 'datetime', 'a', 'b', M, 'provisional', 'obs_count'])
  })
})

describe('elementLabel', () => {
  it('converts metric depths/heights like legacy dist_swap', () => {
    expect(elementLabel('Soil VWC @ -10 cm')).toBe('Soil VWC @ 4 in')
    expect(elementLabel('Soil VWC @ -100 cm')).toBe('Soil VWC @ 40 in')
    expect(elementLabel('Air Temperature @ 2 m')).toBe('Air Temperature @ 6.6 ft')
    expect(elementLabel('Wind Speed @ 10 m')).toBe('Wind Speed @ 33 ft')
    expect(elementLabel('Air Temperature @ 8 ft')).toBe('Air Temperature @ 8 ft')
  })
})

describe('toCsv', () => {
  it('writes the given column order and keeps datetime strings verbatim', () => {
    const csv = toCsv(
      [{ datetime: '2026-09-01 00:00:00-06:00', a: 1.5, b: null, [M]: true }],
      ['datetime', 'a', 'b', M],
    )
    expect(csv).toBe(`datetime,a,b,${M}\n2026-09-01 00:00:00-06:00,1.5,,true`)
  })
})

describe('fetchDownload', () => {
  afterEach(() => vi.unstubAllGlobals())

  const csvResponse = (body: string, status = 200) =>
    ({ ok: status < 400, status, text: async () => body }) as Response

  it('fetches only derived when only derived variables are selected, then aggregates monthly', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url)
      return csvResponse(
        [
          'station,datetime,Reference ET (a=0.23) [in],Feels Like Temperature [°F],has_na',
          'acebozem,2026-08-30 00:00:00-06:00,0.1,60,False',
          'acebozem,2026-08-31 00:00:00-06:00,0.2,70,True',
          'acebozem,2026-09-01 00:00:00-06:00,0.3,50,False',
        ].join('\n'),
      )
    })
    const res = await fetchDownload({
      station: 'acebozem',
      start: '2026-08-30',
      end: '2026-09-01',
      period: 'monthly',
      elements: ['etr', 'feels_like'],
      level: 2,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('derived/daily')
    expect(calls[0]).toContain('elements=etr,feels_like')
    expect(calls[0]).toContain('level=2')
    expect(calls[0]).toContain('end_time=2026-09-02')
    expect(res.columns).toEqual([
      'station',
      'datetime',
      // derived value columns are sorted for a stable header
      'Feels Like Temperature [°F]',
      'Reference ET (a=0.23) [in]',
      M,
      'Days With Data',
    ])
    expect(res.rows[0]).toMatchObject({
      datetime: '2026-08-01',
      // only 2 of 31 August days → no monthly total
      'Reference ET (a=0.23) [in]': null,
      'Feels Like Temperature [°F]': 65,
      [M]: true,
      'Days With Data': 2,
    })
  })

  it('keeps observations and warns when the derived request fails; 404 is empty', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('derived')) return csvResponse('boom', 500)
      return csvResponse(
        [
          'station,datetime,Air Temperature @ 2 m [°F],Logger Reference Pressure [mbar],has_na,obs_count,provisional',
          'acebozem,2026-09-01 00:00:00-06:00,61.5,850,False,288,False',
        ].join('\n'),
      )
    })
    const res = await fetchDownload({
      station: 'acebozem',
      start: '2026-09-01',
      end: '2026-09-01',
      period: 'daily',
      elements: ['air_temp_0200', 'cci'],
      level: 1,
    })
    expect(res.warnings).toHaveLength(1)
    expect(res.columns).toEqual([
      'station',
      'datetime',
      'Air Temperature @ 2 m [°F]',
      M,
      'provisional',
      'obs_count',
    ])
    expect(res.rows[0].datetime).toBe('2026-09-01 00:00:00-06:00')
    expect(res.rows[0][M]).toBe(false)

    vi.stubGlobal('fetch', async () => csvResponse('{"detail":"No data"}', 404))
    const empty = await fetchDownload({
      station: 'acebozem',
      start: '2026-09-01',
      end: '2026-09-01',
      period: 'hourly',
      elements: ['air_temp_0200'],
      level: 0,
    })
    expect(empty.rows).toEqual([])
  })
})
