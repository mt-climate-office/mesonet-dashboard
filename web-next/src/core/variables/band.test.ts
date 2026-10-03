import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import type { LatestTimeseriesModel } from '../charts/latestTimeseries'
import { buildTimeseriesModel } from '../models/timeseries'
import { extremeColumn, hasBand, withBand } from './band'

const day = (d: number) => `2026-09-${String(d).padStart(2, '0')} 00:00:00-06:00`
const means = [1, 2, 3].map((d) => ({ station: 'a', datetime: day(d), 'Air Temperature [°F]': 50 + d })) as ObservationRow[]
const extremes = [1, 3].map((d) => ({
  station: 'a',
  datetime: day(d),
  'Maximum Air Temperature @ 2 m [°F]': 70 + d,
  'Minimum Air Temperature @ 2 m [°F]': 30 + d,
})) as ObservationRow[]
const model = (): LatestTimeseriesModel => {
  const ts = buildTimeseriesModel({ rows: means, vars: ['Air Temperature'], period: 'daily' })!
  return { ts, period: 'daily', view: [0, 1], extent: [0, 1] }
}

describe('band', () => {
  it('bands every variable but totals and wind direction', () => {
    expect(hasBand({ sum: false, name: 'Air Temperature' })).toBe(true)
    expect(hasBand({ sum: true, name: 'Precipitation' })).toBe(false)
    expect(hasBand({ sum: false, name: 'Wind Direction' })).toBe(false)
  })
  it('maps an extreme column to its edge and the mean column (renamed like the mean)', () => {
    expect(extremeColumn('Minimum Air Temperature @ 2 m [°F]')).toEqual({ edge: 'lo', column: 'Air Temperature [°F]' })
    expect(extremeColumn('Maximum Soil VWC @ -5 cm [%]')).toEqual({ edge: 'hi', column: 'Soil VWC @ 2 in [%]' })
    expect(extremeColumn('Air Temperature [°F]')).toBeNull()
  })
  it('attaches each day’s low and high to the mean series; days without extremes stay null', () => {
    const s = withBand(model(), extremes).ts.panels[0].series[0]
    expect(s.values).toEqual([51, 52, 53])
    expect(s.band).toEqual({ lo: [31, null, 33], hi: [71, null, 73] })
  })
  it('leaves the model alone without rows', () => {
    const m = model()
    expect(withBand(m, [])).toBe(m)
  })
})
