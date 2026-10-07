import { describe, expect, it } from 'vitest'
import { GDD_SEASON, gddSeasonWindow } from './gddSeason'
import { GDD_CROPS } from '../data/gddStages'

describe('gddSeasonWindow', () => {
  it('in season: planting through today', () => {
    expect(gddSeasonWindow('wheat', '2026-07-04')).toEqual({ start: '2026-04-15', end: '2026-07-04' })
    expect(gddSeasonWindow('wheat', '2026-04-15')).toEqual({ start: '2026-04-15', end: '2026-04-15' })
  })
  it('after the season: this year planting through season end', () => {
    expect(gddSeasonWindow('wheat', '2026-10-07')).toEqual({ start: '2026-04-15', end: '2026-09-30' })
    expect(gddSeasonWindow('sugarbeet', '2026-10-07')).toEqual({ start: '2026-04-15', end: '2026-10-07' })
  })
  it('before planting: last year’s season', () => {
    expect(gddSeasonWindow('hemp', '2026-03-01')).toEqual({ start: '2025-05-25', end: '2025-10-15' })
    expect(gddSeasonWindow('wheat', '2026-01-01')).toEqual({ start: '2025-04-15', end: '2025-09-30' })
  })
  it('every crop has a season that plants before it ends', () => {
    for (const c of GDD_CROPS) expect(GDD_SEASON[c].plant < GDD_SEASON[c].end).toBe(true)
  })
})
