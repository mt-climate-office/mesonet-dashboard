import { describe, expect, it } from 'vitest'
import { chooseBottomCard, chooseTopCard } from './cardDefaults'

describe('chooseTopCard', () => {
  const base = { explicit: null, station: 'acebozem', hasCamera: false, schedule: 'success' } as const

  it('auto: photo with a camera, wind rose without', () => {
    expect(chooseTopCard({ ...base, hasCamera: true })).toEqual({ card: 'photo', photoEnabled: true, pending: false })
    expect(chooseTopCard(base)).toEqual({ card: 'wind', photoEnabled: false, pending: false })
  })
  it('honours an explicit card', () => {
    expect(chooseTopCard({ ...base, explicit: 'forecast', hasCamera: true }).card).toBe('forecast')
    expect(chooseTopCard({ ...base, explicit: 'wind', hasCamera: true }).card).toBe('wind')
  })
  it('explicit photo without a camera falls back once the schedule answered', () => {
    expect(chooseTopCard({ ...base, explicit: 'photo' }).card).toBe('wind')
    expect(chooseTopCard({ ...base, explicit: 'photo', schedule: 'loading' }).card).toBe('photo')
    expect(chooseTopCard({ ...base, explicit: 'photo', station: null, schedule: 'loading' }).card).toBe('wind')
  })
  it('schedule failure keeps Photo reachable so it can explain', () => {
    expect(chooseTopCard({ ...base, explicit: 'photo', schedule: 'error' })).toMatchObject({ card: 'photo', photoEnabled: true })
    expect(chooseTopCard({ ...base, schedule: 'error' }).card).toBe('wind')
  })
  it('auto waits for the schedule; explicit cards and no station do not', () => {
    expect(chooseTopCard({ ...base, schedule: 'loading' }).pending).toBe(true)
    expect(chooseTopCard({ ...base, explicit: 'wind', schedule: 'loading' }).pending).toBe(false)
    expect(chooseTopCard({ ...base, station: null, schedule: 'loading' }).pending).toBe(false)
  })
  it('no station: photo disabled', () => {
    expect(chooseTopCard({ ...base, station: null, hasCamera: false, schedule: 'error' }).photoEnabled).toBe(false)
  })
})

describe('chooseBottomCard', () => {
  const base = { explicit: null, hasStation: true, latestFailed: false } as const

  it('auto: current with a station, map without', () => {
    expect(chooseBottomCard(base)).toBe('current')
    expect(chooseBottomCard({ ...base, hasStation: false })).toBe('map')
  })
  it('honours explicit values', () => {
    expect(chooseBottomCard({ ...base, explicit: 'map' })).toBe('map')
    expect(chooseBottomCard({ ...base, explicit: 'metadata', hasStation: false })).toBe('metadata')
  })
  it('current without a station → map', () => {
    expect(chooseBottomCard({ ...base, explicit: 'current', hasStation: false })).toBe('map')
  })
  it('auto current with a failed request → metadata; explicit current stays', () => {
    expect(chooseBottomCard({ ...base, latestFailed: true })).toBe('metadata')
    expect(chooseBottomCard({ ...base, explicit: 'current', latestFailed: true })).toBe('current')
  })
})
