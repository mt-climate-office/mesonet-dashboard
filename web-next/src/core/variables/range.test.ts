import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { windowRange } from '../latest/view'
import { activePreset, presetPatch, rangeView } from './range'

const today = dayjs('2026-10-02')
const H = 3_600_000

describe('range presets', () => {
  it('map onto from/to/agg; 14 d hourly is the default (absent dates)', () => {
    expect(presetPatch('24h', today)).toEqual({ from: '2026-10-01', to: '2026-10-02', agg: 'hourly' })
    expect(presetPatch('7d', today)).toEqual({ from: '2026-09-25', to: '2026-10-02', agg: 'hourly' })
    expect(presetPatch('14d', today)).toEqual({ from: null, to: null, agg: 'hourly' })
    expect(presetPatch('1y', today)).toEqual({ from: '2025-10-02', to: '2026-10-02', agg: 'daily' })
  })
  it('read back from the URL; anything else is custom', () => {
    for (const id of ['24h', '7d', '14d', '30d', '1y'] as const) expect(activePreset(presetPatch(id, today), today)).toBe(id)
    expect(activePreset({ from: null, to: null, agg: 'daily' }, today)).toBe('custom')
    expect(activePreset({ from: '2026-09-01', to: '2026-09-20', agg: 'hourly' }, today)).toBe('custom')
    expect(activePreset({ from: 'junk', to: null, agg: 'hourly' }, today)).toBe('custom')
  })
  it('24 h shows the day up to the newest observation; others the whole days', () => {
    const last = windowRange('2026-10-02', '2026-10-02')[0] + 9 * H
    expect(rangeView('24h', '2026-10-01', '2026-10-02', last)).toEqual([last - 24 * H + 1, last + 1])
    expect(rangeView('24h', '2026-10-01', '2026-10-02', null)).toEqual(windowRange('2026-10-01', '2026-10-02'))
    expect(rangeView('7d', '2026-09-25', '2026-10-02', last)).toEqual(windowRange('2026-09-25', '2026-10-02'))
  })
})
