import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { buildWindRoseModel } from '../models/windRose'
import { readUrlState } from '../url-schema'
import { offersRose, roseAnnouncement, roseOffersRange, roseRequest, roseRows, showsRose, WIND_VIEW_CHIPS, windViewPatch } from './rose'

const state = (q: string) => readUrlState(q)

describe('the Rose view switch', () => {
  it('is offered on the Wind direction page only', () => {
    expect(offersRose('wind_dir')).toBe(true)
    expect(offersRose('wind_spd')).toBe(false)
    expect(offersRose(undefined)).toBe(false)
    expect(WIND_VIEW_CHIPS.map((c) => c.label)).toEqual(['Time series', 'Rose'])
  })
  it('shows the rose for wd=rose on that page, never under All years (an old link shows its time series)', () => {
    expect(showsRose(state('?v=wind_dir&wd=rose'), 'wind_dir')).toBe(true)
    expect(showsRose(state('?v=wind_dir'), 'wind_dir')).toBe(false)
    expect(showsRose(state('?v=air_temp&wd=rose'), 'air_temp')).toBe(false)
    expect(showsRose(state('?v=wind_dir&wd=rose&view=history'), 'wind_dir')).toBe(false)
  })
  it('offers every range chip but All years', () => {
    expect(['24h', '7d', '14d', '30d', '1y'].every(roseOffersRange)).toBe(true)
    expect(roseOffersRange('all')).toBe(false)
  })
  it('the rose leaves All years (the default window); the time series clears the key', () => {
    expect(windViewPatch('rose')).toEqual({ wd: 'rose', view: 'recent' })
    expect(windViewPatch('series')).toEqual({ wd: null })
  })
})

describe('roseRequest', () => {
  it('wind speed + direction over the window at its interval', () => {
    const r = roseRequest('acebozem', '2026-10-01', '2026-10-08', 'raw')
    expect(r.query).toMatchObject({ start: '2026-10-01', end: '2026-10-08', period: 'raw', elements: 'wind_spd,wind_dir' })
    expect(r.key).toBe('obs:acebozem:raw:2026-10-01:2026-10-08:wind_spd,wind_dir:rmna')
  })
})

const row = (datetime: string, dir = 225, spd = 6) => ({ datetime, 'Wind Direction [deg]': dir, 'Wind Speed [mi/hr]': spd }) as unknown as ObservationRow

describe('roseRows', () => {
  const rows = ['2026-10-07 09:00:00-06:00', '2026-10-07 10:00:00-06:00', '2026-10-08 09:00:00-06:00'].map((d) => row(d))
  it('24 h: the 24 hours up to the newest reading, as the time series zooms', () => {
    expect(roseRows(rows, '24h').map((r) => r.datetime)).toEqual(['2026-10-07 10:00:00-06:00', '2026-10-08 09:00:00-06:00'])
    expect(roseRows([], '24h')).toEqual([])
  })
  it('any other window: every row', () => {
    expect(roseRows(rows, '7d')).toHaveLength(3)
    expect(roseRows(rows, 'custom')).toHaveLength(3)
  })
})

describe('roseAnnouncement', () => {
  it('names the station, the window, the readings and where the wind came from', () => {
    const m = buildWindRoseModel([row('2026-10-01 01:00:00-06:00'), row('2026-10-08 01:00:00-06:00', 0, 0.3)])!
    expect(roseAnnouncement('Bozeman', m, '7d', 'hourly')).toBe('Wind rose updated: Bozeman, Wind, Oct 1 – Oct 8, 2 hourly readings, most often from SW · 50%.')
    expect(roseAnnouncement('Keogh', m, '24h', 'raw', 'AgriMet')).toBe('Wind rose updated: Keogh, Wind, last 24 hours, 2 15-minute readings, most often from SW · 50%.')
    const calm = buildWindRoseModel([row('2026-10-01 01:00:00-06:00', 0, 0)])!
    expect(roseAnnouncement('Bozeman', calm, '7d', 'raw')).toMatch(/1 5-minute readings, calm throughout\.$/)
  })
})
