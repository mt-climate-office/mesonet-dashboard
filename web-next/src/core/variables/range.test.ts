import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { windowRange } from '../latest/view'
import { activePreset, pageRange, presetPatch, rangeChipPatch, rangeLabel, rangeView, windowPatch } from './range'

const today = dayjs('2026-10-02')
const H = 3_600_000

describe('range chips', () => {
  it('presets map onto from/to; 14 d is the default (absent dates)', () => {
    expect(presetPatch('24h', today)).toEqual({ from: '2026-10-01', to: '2026-10-02' })
    expect(presetPatch('7d', today)).toEqual({ from: '2026-09-25', to: '2026-10-02' })
    expect(presetPatch('14d', today)).toEqual({ from: null, to: null })
    expect(presetPatch('1y', today)).toEqual({ from: '2025-10-02', to: '2026-10-02' })
  })
  it('read back from the URL whatever the interval; anything else is custom', () => {
    for (const id of ['24h', '7d', '14d', '30d', '1y'] as const) expect(activePreset(presetPatch(id, today), today)).toBe(id)
    expect(activePreset({ from: '2026-09-01', to: '2026-09-20' }, today)).toBe('custom')
    expect(activePreset({ from: 'junk', to: null }, today)).toBe('custom')
  })
  it('All years is view=history; a window chip leaves it and drops 5-min where it is not offered', () => {
    expect(pageRange({ view: 'history', from: null, to: null }, today)).toBe('all')
    expect(pageRange({ view: 'table', from: null, to: null }, today)).toBe('14d')
    expect(rangeChipPatch('all', 'raw', today)).toEqual({ view: 'history', from: null, to: null })
    expect(rangeChipPatch('7d', 'raw', today)).toEqual({ view: 'recent', from: '2026-09-25', to: '2026-10-02' })
    expect(rangeChipPatch('30d', 'raw', today)).toMatchObject({ view: 'recent', agg: null })
    expect(rangeChipPatch('30d', 'daily', today)).not.toHaveProperty('agg')
  })
  it('a custom window keeps 5-min up to 7 days and clears it beyond', () => {
    expect(windowPatch('2026-09-01', '2026-09-08', 'raw', today)).toEqual({ view: 'recent', from: '2026-09-01', to: '2026-09-08' })
    expect(windowPatch('2026-09-01', '2026-09-09', 'raw', today)).toEqual({ view: 'recent', from: '2026-09-01', to: '2026-09-09', agg: null })
    expect(windowPatch('2026-09-01', '2026-09-30', 'hourly', today)).not.toHaveProperty('agg')
    expect(windowPatch('2026-09-18', '2026-10-02', null, today)).toEqual({ view: 'recent', from: null, to: null })
  })
  it('labels the range under the title', () => {
    expect(rangeLabel('7d', '', '')).toBe('Last 7 days')
    expect(rangeLabel('all', '', '')).toBe('All years')
    expect(rangeLabel('custom', '2026-09-01', '2026-09-20')).toBe('Sep 1 – Sep 20, 2026')
  })
  it('24 h shows the day up to the newest observation; others the whole days', () => {
    const last = windowRange('2026-10-02', '2026-10-02')[0] + 9 * H
    expect(rangeView('24h', '2026-10-01', '2026-10-02', last)).toEqual([last - 24 * H + 1, last + 1])
    expect(rangeView('24h', '2026-10-01', '2026-10-02', null)).toEqual(windowRange('2026-10-01', '2026-10-02'))
    expect(rangeView('7d', '2026-09-25', '2026-10-02', last)).toEqual(windowRange('2026-09-25', '2026-10-02'))
  })
})
