import { describe, expect, it } from 'vitest'
import { buildPreviewModel } from './downloaderPreview'

describe('buildPreviewModel', () => {
  const rows = [0, 1, 2, 4, 5].map((h) => ({
    station: 'acebozem',
    datetime: `2026-08-28 0${h}:00:00-06:00`,
    'Air Temperature @ 2 m [°F]': 50 + h,
    'Relative Humidity [%]': null,
    note: 'text',
  }))

  it('one panel per numeric, non-bookkeeping column; gaps are broken', () => {
    const m = buildPreviewModel(rows, 'hourly')!
    expect(m.panels.map((p) => p.column)).toEqual(['Air Temperature @ 2 m [°F]'])
    expect(m.panels[0].values).toEqual([50, 51, 52, null, 54, 55])
    expect(m.x[0]).toBe(Date.parse('2026-08-28T00:00:00Z'))
    expect(m.x[3]).toBe(Date.parse('2026-08-28T03:00:00Z'))
    expect(m.markers).toBe(false)
  })

  it('monthly rows are not gap-filled and get month ticks and markers', () => {
    const monthly = [{ datetime: '2026-01-01', x: 1 }, { datetime: '2026-03-01', x: 2 }, { datetime: '2026-04-01', x: 3 }]
    const m = buildPreviewModel(monthly, 'monthly')!
    expect(m.panels[0].values).toEqual([1, 2, 3])
    expect(m).toMatchObject({ monthlyTicks: true, markers: true })
  })

  it('null when there is nothing to plot', () => {
    expect(buildPreviewModel([], 'daily')).toBeNull()
    expect(buildPreviewModel([{ station: 'x', datetime: '2026-01-01' }], 'daily')).toBeNull()
  })
})
