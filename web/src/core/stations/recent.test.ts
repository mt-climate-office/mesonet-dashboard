import { describe, expect, it } from 'vitest'
import {
  DRAWER_KEY,
  RECENT_KEY,
  STATION_KEY,
  isStationId,
  pickerStartsOpen,
  pushRecent,
  readDrawerOpen,
  readRecent,
  readStation,
  rememberStation,
  saveDrawerOpen,
  type StorageLike,
} from './recent'

const mem = (init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => {
  const data = { ...init }
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}
const broken: StorageLike = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('station memory', () => {
  it('validates ids', () => {
    expect(isStationId('acebozem')).toBe(true)
    expect(isStationId('bench_it')).toBe(true)
    expect(isStationId('ACEBOZEM')).toBe(false)
    expect(isStationId('<script>')).toBe(false)
    expect(isStationId('')).toBe(false)
    expect(isStationId(null)).toBe(false)
  })
  it('reads only a valid saved station', () => {
    expect(readStation(mem())).toBeNull()
    expect(readStation(mem({ [STATION_KEY]: 'acebozem' }))).toBe('acebozem')
    expect(readStation(mem({ [STATION_KEY]: 'not valid!' }))).toBeNull()
  })
  it('recent list: newest first, deduped, capped at 5, junk dropped', () => {
    expect(readRecent(mem({ [RECENT_KEY]: 'a1,b2,,BAD,a1,c3,d4,e5,f6,g7' }))).toEqual(['a1', 'b2', 'c3', 'd4', 'e5'])
    expect(pushRecent(['a1', 'b2', 'c3'], 'b2')).toEqual(['b2', 'a1', 'c3'])
    expect(pushRecent(['a1', 'b2', 'c3', 'd4', 'e5'], 'f6')).toEqual(['f6', 'a1', 'b2', 'c3', 'd4'])
  })
  it('rememberStation writes the last station and the recent list', () => {
    const s = mem({ [RECENT_KEY]: 'acecrowa,arskeogh' })
    rememberStation(s, 'acebozem')
    expect(s.data[STATION_KEY]).toBe('acebozem')
    expect(s.data[RECENT_KEY]).toBe('acebozem,acecrowa,arskeogh')
    rememberStation(s, 'arskeogh')
    expect(s.data[RECENT_KEY]).toBe('arskeogh,acebozem,acecrowa')
    rememberStation(s, 'BAD ID')
    expect(s.data[STATION_KEY]).toBe('arskeogh')
  })
  it('survives storage that throws', () => {
    expect(readStation(broken)).toBeNull()
    expect(readRecent(broken)).toEqual([])
    expect(() => rememberStation(broken, 'acebozem')).not.toThrow()
    expect(readDrawerOpen(broken)).toBeNull()
  })
})

describe('drawer memory', () => {
  it('round-trips open/closed and ignores junk', () => {
    const s = mem()
    expect(readDrawerOpen(s)).toBeNull()
    saveDrawerOpen(s, false)
    expect(s.data[DRAWER_KEY]).toBe('closed')
    expect(readDrawerOpen(s)).toBe(false)
    saveDrawerOpen(s, true)
    expect(readDrawerOpen(s)).toBe(true)
    expect(readDrawerOpen(mem({ [DRAWER_KEY]: 'yes' }))).toBeNull()
  })
  it('pickerStartsOpen: never without a station (the landing); else only a saved-open desktop drawer', () => {
    expect(pickerStartsOpen(false, false, null)).toBe(false)
    expect(pickerStartsOpen(false, true, true)).toBe(false)
    expect(pickerStartsOpen(true, true, true)).toBe(true)
    expect(pickerStartsOpen(true, true, null)).toBe(false)
    expect(pickerStartsOpen(true, false, true)).toBe(false)
  })
})
