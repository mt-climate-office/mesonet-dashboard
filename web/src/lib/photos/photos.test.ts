import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  basename,
  compactUtc,
  confirmDerived,
  directionLabel,
  fetchLatestFrames,
  fetchMonthFrames,
  fillPattern,
  formatLocal,
  framesFor,
  framesFromListing,
  hasCamera,
  localToUtcMs,
  localYmd,
  parseListingKeys,
  parseManifest,
  parseSchedule,
  parseUtc,
  patternPrefix,
  utcDaysOfLocalDay,
  viewsBetween,
  DEFAULT_PATTERNS,
  type RawSchedule,
} from '.'

const B = 'https://data2.climate.umt.edu/mesonet/'

const RAW: RawSchedule = {
  patterns: { base: B, ...DEFAULT_PATTERNS },
  snap_max_seconds: 1800,
  stations: {
    acebozem: {
      first_month: '2017-01',
      name: 'Bozeman',
      periods: [
        {
          from: '2000-01-01T00:00:00-07:00',
          until: '2026-09-20T10:06:00-06:00',
          views: {
            S: { view: 'South', slots_local: ['09:00', '15:00'] },
            N: { view: 'North', slots_local: ['09:00', '15:00'] },
            NS: { view: 'NS', slots_local: ['09:00', '15:00'] },
          },
        },
        {
          from: '2026-09-20T10:06:00-06:00',
          until: null,
          views: {
            SNOW: { view: 'Snow', slots_local: ['09:00', '12:00', '15:00'] },
            N: { view: 'North', slots_local: ['09:00', '12:00', '15:00'] },
            E: { view: 'East', slots_local: ['09:00', '12:00', '15:00'] },
          },
        },
      ],
    },
    oldcam: {
      first_month: '2020-01',
      periods: [{ from: '2020-01-01T00:00:00-07:00', until: '2021-01-01T00:00:00-07:00', views: { N: {} } }],
    },
  },
}

describe('time', () => {
  it('local slot → UTC is DST-safe', () => {
    expect(new Date(localToUtcMs('2026-07-15', '09:00')).toISOString()).toBe('2026-07-15T15:00:00.000Z')
    expect(new Date(localToUtcMs('2026-01-15', '09:00')).toISOString()).toBe('2026-01-15T16:00:00.000Z')
    // Transition days: 2026-03-08 (spring forward), 2026-11-01 (fall back).
    expect(new Date(localToUtcMs('2026-03-08', '12:00')).toISOString()).toBe('2026-03-08T18:00:00.000Z')
    expect(new Date(localToUtcMs('2026-11-01', '12:00')).toISOString()).toBe('2026-11-01T19:00:00.000Z')
    expect(new Date(localToUtcMs('2026-11-01')).toISOString()).toBe('2026-11-01T06:00:00.000Z')
  })
  it('compact UTC round-trips', () => {
    const ms = Date.UTC(2026, 9, 1, 15, 0, 1)
    expect(compactUtc(ms)).toBe('20261001T150001Z')
    expect(parseUtc('20261001T150001Z')).toBe(ms)
    expect(parseUtc('2026-10-01T15:00:01Z')).toBe(ms)
    expect(parseUtc('')).toBeNaN()
  })
  it('local day helpers + labels', () => {
    expect(localYmd(Date.UTC(2026, 9, 2, 3))).toBe('2026-10-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(utcDaysOfLocalDay('2026-10-01')).toEqual(['20261001', '20261002'])
    expect(formatLocal(Date.UTC(2026, 9, 1, 21))).toBe('Oct 1, 2026 3:00 PM')
  })
})

describe('schedule', () => {
  const s = parseSchedule(RAW)
  it('current views in canonical order with legacy labels', () => {
    const cam = s.stations.get('acebozem')!
    expect(cam.name).toBe('Bozeman')
    expect(cam.firstMonth).toBe('2017-01')
    expect(cam.currentViews).toEqual([
      { token: 'N', label: 'North' },
      { token: 'E', label: 'East' },
      { token: 'SNOW', label: 'Snow' },
    ])
    expect(cam.allLabels).toMatchObject({ NS: 'North Sky', S: 'South', SNOW: 'Snow' })
    expect(s.snapMaxMs).toBe(1_800_000)
    expect(s.base).toBe(B)
  })
  it('hasCamera needs a current period with views', () => {
    expect(hasCamera(s, 'acebozem')).toBe(true)
    expect(hasCamera(s, 'oldcam')).toBe(false)
    expect(hasCamera(s, 'nope')).toBe(false)
    expect(hasCamera(undefined, 'acebozem')).toBe(false)
  })
  it('viewsBetween picks the periods overlapping a day', () => {
    const cam = s.stations.get('acebozem')!
    const day = (d: string) => viewsBetween(cam, localToUtcMs(d), localToUtcMs(addDays(d, 1))).map((v) => v.token)
    expect(day('2025-07-15')).toEqual(['N', 'S', 'NS'])
    expect(day('2026-09-20')).toEqual(['N', 'S', 'E', 'SNOW', 'NS'])
    expect(day('2026-09-30')).toEqual(['N', 'E', 'SNOW'])
  })
  it('directionLabel prefers legacy words', () => {
    expect(directionLabel('SS', 'SS')).toBe('South Sky')
    expect(directionLabel('X', 'Weird')).toBe('Weird')
    expect(directionLabel('X')).toBe('X')
  })
})

describe('paths', () => {
  it('fills patterns', () => {
    const slot = Date.UTC(2026, 9, 1, 15)
    expect(fillPattern(DEFAULT_PATTERNS.webp_large, { station: 'acebozem', token: 'N', slotUtcMs: slot })).toBe(
      'photos/webp/large/acebozem/acebozem_N_20261001T150000Z.webp',
    )
    expect(
      fillPattern(DEFAULT_PATTERNS.jpg, { station: 'acebozem', token: 'N', capturedUtcMs: slot + 1000 }),
    ).toBe('photos/jpg/acebozem/acebozem_N_20261001T150001Z.jpg')
    expect(patternPrefix(DEFAULT_PATTERNS.webp_large, 'acebozem', 'N')).toBe(
      'photos/webp/large/acebozem/acebozem_N_',
    )
    expect(basename(`${B}photos/webp/large/a/a_N_20261001T150000Z.webp`)).toBe('a_N_20261001T150000Z.webp')
  })
})

const LISTING = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult><Name>mco-mesonet</Name><KeyCount>2</KeyCount>
<Contents><Key>photos/webp/large/acebozem/acebozem_N_20261001T150000Z.webp</Key><Size>1</Size></Contents>
<Contents><Key>photos/webp/large/acebozem/acebozem_N_20261001T180000Z.webp</Key><Size>1</Size></Contents>
<Contents><Key>photos/webp/large/acebozem/notes.txt</Key></Contents>
</ListBucketResult>`

describe('listing', () => {
  it('parses keys and frames', () => {
    expect(parseListingKeys(LISTING)).toHaveLength(3)
    const f = framesFromListing(LISTING, 'acebozem', 'N', { base: B, labels: { N: 'North' } })
    expect(f).toHaveLength(2)
    expect(f[0]).toMatchObject({
      token: 'N',
      label: 'North',
      slotUtcMs: Date.UTC(2026, 9, 1, 15),
      webpUrl: `${B}photos/webp/large/acebozem/acebozem_N_20261001T150000Z.webp`,
      thumbUrl: `${B}photos/webp/thumb/acebozem/acebozem_N_20261001T150000Z.webp`,
    })
    expect(framesFromListing('', 'acebozem', 'N')).toEqual([])
  })
})

const HEADER = 'station,view,token,captured_utc,captured_local,date_local,time_local,slot_utc,jpg,webp_large,webp_thumb'
const MANIFEST = [
  HEADER,
  // complete row
  'acebozem,North,N,2026-09-01T15:00:05Z,2026-09-01T09:00:05-06:00,2026-09-01,09:00:05,2026-09-01T15:00:00Z,photos/jpg/acebozem/acebozem_N_20260901T150005Z.jpg,photos/webp/large/acebozem/acebozem_N_20260901T150000Z.webp,photos/webp/thumb/acebozem/acebozem_N_20260901T150000Z.webp',
  // blank webp_large, slot present → derive from slot
  'acebozem,,N,2026-09-01T18:00:30Z,,2026-09-01,,2026-09-01T18:00:00Z,photos/jpg/acebozem/acebozem_N_20260901T180030Z.jpg,,',
  // blank slot + webp → snap capture to nearest hour
  'acebozem,,NS,2026-09-01T20:59:40Z,,2026-09-01,,,photos/jpg/acebozem/acebozem_NS_20260901T205940Z.jpg,,',
  // > 30 min from its slot → jpg only, skipped
  'acebozem,,N,2026-09-01T18:45:00Z,,2026-09-01,,2026-09-01T18:00:00Z,photos/jpg/acebozem/acebozem_N_20260901T184500Z.jpg,,',
  // duplicate of the first slot (re-shot) → deduplicated
  'acebozem,North,N,2026-09-01T15:02:00Z,,2026-09-01,,2026-09-01T15:00:00Z,photos/jpg/acebozem/acebozem_N_20260901T150200Z.jpg,photos/webp/large/acebozem/acebozem_N_20260901T150000Z.webp,',
  '',
].join('\r\n')

describe('manifest', () => {
  const frames = parseManifest(MANIFEST, 'acebozem', { base: B, snapMaxMs: 1_800_000 })
  it('handles the blank-webp quirk and snap limit', () => {
    expect(frames.map((f) => basename(f.webpUrl))).toEqual([
      'acebozem_N_20260901T150000Z.webp',
      'acebozem_N_20260901T180000Z.webp',
      'acebozem_NS_20260901T210000Z.webp',
    ])
    expect(frames[0].jpgUrl).toBe(`${B}photos/jpg/acebozem/acebozem_N_20260901T150005Z.jpg`)
    expect(frames[0].capturedUtcMs).toBe(Date.UTC(2026, 8, 1, 15, 0, 5))
    expect(frames[0].label).toBe('North')
    expect(frames[0].derived).toBeUndefined()
    expect(frames[1].derived).toBe(true)
    expect(frames[1].thumbUrl).toBe(`${B}photos/webp/thumb/acebozem/acebozem_N_20260901T180000Z.webp`)
  })
  it('header only / empty → []', () => {
    expect(parseManifest(HEADER, 'acebozem')).toEqual([])
    expect(parseManifest('', 'acebozem')).toEqual([])
  })
  it('framesFor selects a local day, newest first', () => {
    expect(framesFor(frames, '2026-09-01', 'N').map((f) => f.slotUtcMs)).toEqual([
      Date.UTC(2026, 8, 1, 18),
      Date.UTC(2026, 8, 1, 15),
    ])
    expect(framesFor(frames, '2026-09-02')).toEqual([])
  })
})

describe('fetchers', () => {
  afterEach(() => vi.unstubAllGlobals())
  const schedule = parseSchedule(RAW)
  const cam = schedule.stations.get('acebozem')!

  it('latest lists today + yesterday UTC per current view; 404/errors → empty', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url)
      if (url.includes('acebozem_N_20261001')) return new Response(LISTING)
      if (url.includes('_E_')) return new Response('boom', { status: 500 })
      return new Response('', { status: 404 })
    })
    const frames = await fetchLatestFrames(schedule, cam, Date.UTC(2026, 9, 1, 22))
    expect(urls).toHaveLength(6)
    expect(urls[0]).toBe(
      `${B}?list-type=2&prefix=${encodeURIComponent('photos/webp/large/acebozem/acebozem_N_20260930')}`,
    )
    expect(urls.every((u) => !u.includes('/api/'))).toBe(true)
    expect(frames).toHaveLength(2)
  })

  it('confirmDerived keeps only derived frames the bucket lists', async () => {
    const frames = parseManifest(MANIFEST, 'acebozem', { base: B })
    const urls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url)
      if (url.includes(encodeURIComponent('acebozem_N_20260901'))) {
        return new Response('<Key>photos/webp/large/acebozem/acebozem_N_20260901T180000Z.webp</Key>')
      }
      return new Response('', { status: 404 })
    })
    const kept = await confirmDerived(schedule, cam, frames)
    expect(kept.map((f) => basename(f.webpUrl))).toEqual([
      'acebozem_N_20260901T150000Z.webp',
      'acebozem_N_20260901T180000Z.webp',
    ])
    expect(urls).toHaveLength(2) // N + NS on 2026-09-01; the non-derived frame needs no listing
  })

  it('month manifest URL; 404 → []', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url)
      return url.endsWith('_2026-09.csv') ? new Response(MANIFEST) : new Response('', { status: 404 })
    })
    expect(await fetchMonthFrames(schedule, cam, '2026-09')).toHaveLength(3)
    expect(await fetchMonthFrames(schedule, cam, '2016-01')).toEqual([])
    expect(urls[0]).toBe(`${B}photos/manifest/acebozem/acebozem_2026-09.csv`)
  })
})
