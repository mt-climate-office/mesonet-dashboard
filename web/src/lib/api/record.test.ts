import { afterEach, describe, expect, it, vi } from 'vitest'
import { exclusiveEnd, fmtDate, getStationRecord } from './record'
import { mergeOn } from './http'
import type { ObservationRow } from './types'

describe('exclusiveEnd', () => {
  it('adds one day to an inclusive end date', () => {
    expect(exclusiveEnd('2026-06-30')).toBe('2026-07-01')
    expect(exclusiveEnd('2026-06-15')).toBe('2026-06-16')
  })
  it('rolls over months and years', () => {
    expect(exclusiveEnd('2026-01-31')).toBe('2026-02-01')
    expect(exclusiveEnd('2025-12-31')).toBe('2026-01-01')
  })
  it('handles leap years', () => {
    expect(exclusiveEnd('2024-02-28')).toBe('2024-02-29')
    expect(exclusiveEnd('2025-02-28')).toBe('2025-03-01')
  })
  it('accepts Date (UTC date part)', () => {
    expect(exclusiveEnd(new Date(Date.UTC(2026, 8, 30, 12)))).toBe('2026-10-01')
  })
})

describe('fmtDate', () => {
  it('passes strings through and formats Dates as UTC YYYY-MM-DD', () => {
    expect(fmtDate('2026-06-01')).toBe('2026-06-01')
    expect(fmtDate(new Date(Date.UTC(2026, 5, 1)))).toBe('2026-06-01')
  })
})

describe('mergeOn', () => {
  const l: ObservationRow[] = [
    { station: 'a', datetime: 't1', x: 1 },
    { station: 'a', datetime: 't2', x: 2 },
  ]
  const r: ObservationRow[] = [{ station: 'a', datetime: 't2', y: 9 }]
  it('left-joins on keys', () => {
    expect(mergeOn(l, r, ['station', 'datetime'])).toEqual([
      { station: 'a', datetime: 't1', x: 1 },
      { station: 'a', datetime: 't2', x: 2, y: 9 },
    ])
  })
  it('returns the other side when one is empty', () => {
    expect(mergeOn([], r, ['station'])).toBe(r)
    expect(mergeOn(l, [], ['station'])).toBe(l)
  })
})

describe('getStationRecord QC level', () => {
  afterEach(() => vi.unstubAllGlobals())

  const capture = () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url)
      return new Response('station,datetime\n', { status: 200 })
    })
    return urls
  }

  it('defaults to level 2 for observations and derived ETr', async () => {
    const urls = capture()
    await getStationRecord({
      station: 'acebozem',
      start: '2026-09-01',
      end: '2026-09-02',
      period: 'daily',
      elements: 'air_temp',
      hasEtr: true,
    })
    expect(urls).toHaveLength(2)
    for (const u of urls) expect(new URL(u, 'http://x').searchParams.get('level')).toBe('2')
  })

  it('honors an explicit level', async () => {
    const urls = capture()
    await getStationRecord({
      station: 'acebozem',
      start: '2026-09-01',
      period: 'hourly',
      elements: 'air_temp',
      level: 1,
    })
    expect(new URL(urls[0], 'http://x').searchParams.get('level')).toBe('1')
  })
})
