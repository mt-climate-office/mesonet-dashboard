import { describe, expect, it } from 'vitest'
import { framesFromListing, parseSchedule, type PhotoFrame, type RawSchedule } from '../photos'
import { derivedKey, isRecentDay, knownFrames, noCameraImages, photoDay, photoLabel, photoMinDay, photoPick, photoTimeOptions } from './photo'

const B = 'https://data2.climate.umt.edu/mesonet/'
const RAW: RawSchedule = {
  stations: {
    acebozem: {
      first_month: '2017-01',
      periods: [
        { from: '2000-01-01T00:00:00-07:00', until: '2026-09-20T10:06:00-06:00', views: { S: { view: 'South' }, N: { view: 'North' }, NS: {} } },
        { from: '2026-09-20T10:06:00-06:00', until: null, views: { SNOW: {}, N: {}, E: {} } },
      ],
    },
  },
}
const cam = parseSchedule(RAW).stations.get('acebozem')!

const listing = (token: string, ...stamps: string[]) =>
  framesFromListing(
    stamps.map((t) => `<Key>photos/webp/large/acebozem/acebozem_${token}_${t}.webp</Key>`).join(''),
    'acebozem',
    token,
    { base: B, labels: cam.allLabels },
  )

// 2026-10-01 09:00 / 15:00 MDT = 15:00Z / 21:00Z.
const frames: PhotoFrame[] = [
  ...listing('N', '20261001T150000Z', '20261001T210000Z', '20260930T210000Z'),
  ...listing('E', '20261001T150000Z'),
]

describe('photoDay / isRecentDay / photoMinDay', () => {
  it('defaults to the newest latest frame’s local day, else today', () => {
    expect(photoDay(null, frames, '2026-10-02')).toBe('2026-10-01')
    expect(photoDay(null, [], '2026-10-02')).toBe('2026-10-02')
    expect(photoDay('2026-09-01', frames, '2026-10-02')).toBe('2026-09-01')
  })
  it('today and yesterday are recent', () => {
    expect(isRecentDay('2026-10-01', '2026-10-01')).toBe(true)
    expect(isRecentDay('2026-09-30', '2026-10-01')).toBe(true)
    expect(isRecentDay('2026-09-29', '2026-10-01')).toBe(false)
  })
  it('min day from first_month', () => {
    expect(photoMinDay(cam)).toBe('2017-01-01')
    expect(noCameraImages(cam)).toBe(false)
    expect(noCameraImages(undefined)).toBe(true)
  })
})

describe('photoPick', () => {
  const base = { station: 'acebozem', cam, day: '2026-10-01', recent: true, frames, direction: null, slotUtcMs: null }

  it('chips from the day’s frames with legacy labels; N by default; newest frame', () => {
    const p = photoPick(base)
    expect(p.tokens).toEqual(['N', 'E'])
    expect(p.labels).toEqual({ N: 'North', E: 'East' })
    expect(p.direction).toBe('N')
    expect(p.frames.map((f) => f.slotUtcMs)).toEqual([Date.UTC(2026, 9, 1, 21), Date.UTC(2026, 9, 1, 15)])
    expect(p.active?.webpUrl).toBe(`${B}photos/webp/large/acebozem/acebozem_N_20261001T210000Z.webp`)
    expect(p.stamp).toBe('Oct 1, 2026 3:00 PM')
    expect(p.alt).toBe('acebozem North camera Oct 1, 2026 3:00 PM')
  })
  it('honours a picked direction and slot', () => {
    const p = photoPick({ ...base, direction: 'N', slotUtcMs: Date.UTC(2026, 9, 1, 15) })
    expect(p.active?.slotUtcMs).toBe(Date.UTC(2026, 9, 1, 15))
    expect(photoPick({ ...base, direction: 'E' }).frames).toHaveLength(1)
    // A direction not offered that day falls back to N.
    expect(photoPick({ ...base, direction: 'SNOW' }).direction).toBe('N')
  })
  it('no frames: chips from the schedule (current views when recent, else that day’s periods)', () => {
    expect(photoPick({ ...base, frames: undefined }).tokens).toEqual(['N', 'E', 'SNOW'])
    expect(photoPick({ ...base, frames: [], day: '2025-07-01', recent: false }).tokens).toEqual(['N', 'S', 'NS'])
    const none = photoPick({ ...base, frames: [] })
    expect(none.active).toBeUndefined()
    expect(none.alt).toBe('acebozem North camera')
  })
  it('time options are local labels keyed by slot ms', () => {
    expect(photoTimeOptions(photoPick(base).frames)).toEqual([
      { value: String(Date.UTC(2026, 9, 1, 21)), label: 'Oct 1, 2026 3:00 PM' },
      { value: String(Date.UTC(2026, 9, 1, 15)), label: 'Oct 1, 2026 9:00 AM' },
    ])
  })
})

describe('labels', () => {
  it('a day with no views still has a direction label (pre-install / gap days)', () => {
    const p = photoPick({ station: 'acebozem', cam, day: '1999-01-01', recent: false, frames: [], direction: null, slotUtcMs: null })
    expect(p.tokens).toEqual([])
    expect(p.direction).toBe('N')
    expect(p.label).toBe('North')
    expect(p.labels.N).toBeUndefined()
    expect(p.alt).toBe('acebozem North camera')
  })
  it('photoLabel falls back to legacy words, then the token', () => {
    expect(photoLabel(cam, 'NS')).toBe('North Sky')
    expect(photoLabel(cam, 'SS')).toBe('South Sky')
    expect(photoLabel(cam, 'XYZ')).toBe('XYZ')
  })
})

describe('knownFrames', () => {
  it('drops derived frames', () => {
    expect(knownFrames([{ ...frames[0], derived: true }, frames[1]])).toEqual([frames[1]])
  })
})

describe('derivedKey', () => {
  it('lists derived basenames only', () => {
    expect(derivedKey(frames)).toBe('')
    const d = [{ ...frames[1], derived: true }, { ...frames[0], derived: true }]
    expect(derivedKey(d)).toBe('acebozem_N_20261001T150000Z.webp,acebozem_N_20261001T210000Z.webp')
  })
})
