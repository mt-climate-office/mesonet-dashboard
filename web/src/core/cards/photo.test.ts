import { describe, expect, it } from 'vitest'
import { photos, type PhotoFrame, type RawSchedule } from '../photos'
import { derivedKey, isRecentDay, knownFrames, noCameraImages, photoDay, photoLabel, photoMessage, photoMinDay, photoPick, photoSlides, photoState, photoTimeOptions, photoTitle } from './photo'

// MCO.photos is the pinned kit file (test/kit.ts), the same bytes index.html loads.
const P = photos()
const B = 'https://data2.climate.umt.edu/mesonet/'
const view = (name: string, slots: string[]) => ({ view: name, slots_local: slots })
const S915 = ['09:00', '15:00']
const S3 = ['09:00', '12:00', '15:00']
// Shaped like the live schedule: the legacy patrol, the eight-view plan from 2026-09-20 (N on the
// rain gauge, S on the snow stake), and the re-aimed plan from 2026-10-21 16:00 MDT (website D7).
const RAW: RawSchedule = {
  schema: 1,
  stations: {
    acebozem: {
      first_month: '2017-01',
      name: 'Bozeman',
      periods: [
        { from: '2000-01-01T00:00:00-07:00', until: '2026-09-20T10:06:00-06:00', views: { S: view('South', S915), N: view('North', S915), E: view('East', S915), NS: view('NS', S915) } },
        { from: '2026-09-20T10:06:00-06:00', until: '2026-10-21T16:00:00-06:00', views: { N: view('North', S3), E: view('East', S3), S: view('South', S3), W: view('West', S3), SNOW: view('Snow', S3) } },
        { from: '2026-10-21T16:00:00-06:00', until: null, views: { SNOW: view('Snow', ['09:00']), N: view('North', S3), E: view('East', S3), W: view('West', S3), PARK: view('Park', S3) } },
      ],
    },
    acenewer: {
      first_month: '2026-11',
      periods: [{ from: '2026-11-04T00:00:00-07:00', until: null, views: { N: view('North', S3) } }],
    },
    // Only views the public never sees: left out of the public schedule.
    acesnowy: { first_month: '2020-01', periods: [{ from: '2020-01-01T00:00:00-07:00', until: null, views: { SNOW: view('Snow', S3) } }] },
  },
}
const schedule = P.parseSchedule(RAW)
const cam = schedule.stations.get('acebozem')!

const listing = (token: string, ...stamps: string[]) =>
  P.framesFromListing(
    stamps.map((t) => `<Key>photos/webp/large/acebozem/acebozem_${token}_${t}.webp</Key>`).join(''),
    'acebozem',
    token,
    { base: B, labels: cam.allLabels, allow: P.frameFilter(schedule) },
  )

// 2026-10-23 09:00 / 15:00 MDT = 15:00Z / 21:00Z.
const frames: PhotoFrame[] = [
  ...listing('N', '20261023T150000Z', '20261023T210000Z', '20261022T210000Z'),
  ...listing('E', '20261023T150000Z'),
  ...listing('W', '20261023T150000Z', '20261023T210000Z'),
]

describe('the public schedule and frames (MCO.photos, D7)', () => {
  it('keeps N, E, S, W only; a station with no public view is left out', () => {
    expect([...schedule.stations.keys()].sort()).toEqual(['acebozem', 'acenewer'])
    expect(cam.currentViews.map((v) => v.token)).toEqual(['N', 'E', 'W'])
    expect(schedule.minDate).toBe('2026-10-22')
  })
  it('drops frames from before the re-aim and frames of staff views', () => {
    expect(listing('N', '20261001T150000Z', '20261021T210000Z', '20261022T150000Z').map((f) => f.slotUtcMs)).toEqual([Date.UTC(2026, 9, 22, 15)])
    expect(listing('SNOW', '20261023T150000Z')).toEqual([])
  })
})

describe('photoDay / isRecentDay / photoMinDay', () => {
  it('defaults to the newest latest frame’s local day, else today', () => {
    expect(photoDay(null, frames, '2026-10-24')).toBe('2026-10-23')
    expect(photoDay(null, [], '2026-10-24')).toBe('2026-10-24')
    expect(photoDay('2026-10-22', frames, '2026-10-24')).toBe('2026-10-22')
  })
  it('today and yesterday are recent', () => {
    expect(isRecentDay('2026-10-23', '2026-10-23')).toBe(true)
    expect(isRecentDay('2026-10-22', '2026-10-23')).toBe(true)
    expect(isRecentDay('2026-10-21', '2026-10-23')).toBe(false)
  })
  it('min day: the first public day (D7), else the camera\'s first month or first window', () => {
    expect(photoMinDay(schedule, cam)).toBe('2026-10-22')
    expect(photoMinDay(schedule, schedule.stations.get('acenewer')!)).toBe('2026-11-04')
    expect(photoMinDay({ minDate: null }, cam)).toBe('2026-10-21')
    expect(noCameraImages(cam)).toBe(false)
    expect(noCameraImages(undefined)).toBe(true)
    expect(noCameraImages(schedule.stations.get('acesnowy'))).toBe(true)
  })
})

describe('photoSlides', () => {
  const base = { station: 'acebozem', cam, day: '2026-10-23', recent: true, frames, direction: 'E', slotUtcMs: 1 }
  it('the newest frame of each direction, N E S W order (North first); picks ignored', () => {
    const s = photoSlides(base)
    expect(s.map((p) => p.direction)).toEqual(['N', 'E', 'W'])
    expect(s.map((p) => p.active?.slotUtcMs)).toEqual([Date.UTC(2026, 9, 23, 21), Date.UTC(2026, 9, 23, 15), Date.UTC(2026, 9, 23, 21)])
  })
  it('directions without a frame that day are left out; no frames, no slides', () => {
    expect(photoSlides({ ...base, frames: frames.filter((f) => f.token === 'E') }).map((p) => p.direction)).toEqual(['E'])
    expect(photoSlides({ ...base, frames: [] })).toEqual([])
  })
})

describe('photoPick', () => {
  const base = { station: 'acebozem', cam, day: '2026-10-23', recent: true, frames, direction: null, slotUtcMs: null }

  it('chips from the day’s frames, labelled; North by default; newest frame', () => {
    const p = photoPick(base)
    expect(p.tokens).toEqual(['N', 'E', 'W'])
    expect(p.labels).toEqual({ N: 'North', E: 'East', W: 'West' })
    expect(p.direction).toBe('N')
    expect(p.frames.map((f) => f.slotUtcMs)).toEqual([Date.UTC(2026, 9, 23, 21), Date.UTC(2026, 9, 23, 15)])
    expect(p.active?.webpUrl).toBe(`${B}photos/webp/large/acebozem/acebozem_N_20261023T210000Z.webp`)
    expect(p.stamp).toBe('Oct 23, 2026 3:00 PM')
    expect(p.alt).toBe('acebozem North camera Oct 23, 2026 3:00 PM')
  })
  it('honours a picked direction and slot', () => {
    const p = photoPick({ ...base, direction: 'N', slotUtcMs: Date.UTC(2026, 9, 23, 15) })
    expect(p.active?.slotUtcMs).toBe(Date.UTC(2026, 9, 23, 15))
    expect(photoPick({ ...base, direction: 'E' }).frames).toHaveLength(1)
    // A direction not offered that day (or a hidden one) falls back to North.
    expect(photoPick({ ...base, direction: 'SNOW' }).direction).toBe('N')
    expect(photoPick({ ...base, direction: 'S' }).direction).toBe('N')
  })
  it('no frames: chips from the schedule (current views when recent, else that day’s windows)', () => {
    expect(photoPick({ ...base, frames: undefined }).tokens).toEqual(['N', 'E', 'W'])
    expect(photoPick({ ...base, frames: [], day: '2026-10-22', recent: false }).tokens).toEqual(['N', 'E', 'W'])
    // Before the re-aim nothing is public, whatever the camera shot (D7).
    expect(photoPick({ ...base, frames: [], day: '2025-07-01', recent: false }).tokens).toEqual([])
    const none = photoPick({ ...base, frames: [] })
    expect(none.active).toBeUndefined()
    expect(none.alt).toBe('acebozem North camera')
  })
  it('the first cardinal view opens when a day has no North', () => {
    expect(photoPick({ ...base, frames: frames.filter((f) => f.token !== 'N') }).direction).toBe('E')
  })
  it('time options are local labels keyed by slot ms', () => {
    expect(photoTimeOptions(photoPick(base).frames)).toEqual([
      { value: String(Date.UTC(2026, 9, 23, 21)), label: '3:00 PM' },
      { value: String(Date.UTC(2026, 9, 23, 15)), label: '9:00 AM' },
    ])
  })
  it('the dialog title names the station, direction and stamp', () => {
    expect(photoTitle('Bozeman', photoPick({ ...base, station: 'Bozeman' }))).toBe('Bozeman · North · Oct 23, 2026 3:00 PM')
    expect(photoTitle('Bozeman', photoPick({ ...base, frames: [] }))).toBe('Bozeman · North')
    expect(photoTitle('Bozeman', null)).toBe('')
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
  it('photoLabel falls back to the kit\'s words, then the token', () => {
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
    expect(derivedKey(d)).toBe('acebozem_N_20261023T150000Z.webp,acebozem_N_20261023T210000Z.webp')
  })
})

describe('photoState / photoMessage', () => {
  const pick = photoPick({ station: 'acebozem', cam, day: '2026-10-23', recent: true, frames, direction: null, slotUtcMs: null })
  const empty = photoPick({ station: 'acebozem', cam, day: '2026-10-24', recent: true, frames, direction: null, slotUtcMs: null })
  const ok = { schedule: 'success' as const, cam, source: { status: 'success' as const, data: frames }, pick }

  it('ready with a frame; a message for an empty day', () => {
    expect(photoState(ok)).toBe('ready')
    expect(photoState({ ...ok, pick: empty })).toBe('message')
    expect(photoMessage({ ...ok, pick: empty })).toBe('No camera images are available for North on this date.')
  })
  it('loading while the schedule or a first source fetch loads; stale frames stay shown', () => {
    expect(photoState({ ...ok, schedule: 'loading' })).toBe('loading')
    expect(photoState({ ...ok, source: null })).toBe('loading')
    expect(photoState({ ...ok, source: { status: 'loading', data: undefined } })).toBe('loading')
    expect(photoState({ ...ok, source: { status: 'loading', data: frames } })).toBe('ready')
  })
  it('messages for a failed schedule, no camera, a failed source', () => {
    expect(photoMessage({ ...ok, schedule: 'error' })).toBe('Camera schedule unavailable.')
    expect(photoState({ ...ok, cam: undefined })).toBe('message')
    expect(photoMessage({ ...ok, cam: undefined })).toBe('No camera images are available for this station.')
    expect(photoMessage({ ...ok, source: { status: 'error', data: undefined }, pick: empty })).toBe('Camera images could not be loaded.')
  })
})
