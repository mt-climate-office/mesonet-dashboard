import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { buildWindRoseModel } from '../models/windRose'
import { THEMES, binColors } from '../palette'
import { testCtx } from './testing'
import { binName, windRoseChart, windRoseTable, windRoseTitle } from './windRose'

const rows = [
  [0, 1.2],
  [10, 3.4],
  [90, 5.1],
  [180, 8.6],
  [270, 12.2],
  [355, 2.2],
  [45, 15.9],
  [135, 6.6],
  [225, 9.4],
  [315, 20.1],
].map(([dir, spd], i): ObservationRow => ({
  station: 'acebozem',
  datetime: `2026-09-${String(17 + (i % 3)).padStart(2, '0')} 10:00:00-06:00`,
  'Wind Direction [deg]': dir,
  'Wind Speed [mi/hr]': spd,
}))
const model = buildWindRoseModel(rows)!

type Bar = { type: string; coordinateSystem: string; name: string; stack: string; data: number[]; color: string }

describe('windRoseChart', () => {
  it('one stacked polar bar series per bin, batlow slow → fast per theme', () => {
    for (const t of THEMES) {
      const o = windRoseChart(model, testCtx(t))
      const s = o.series as Bar[]
      expect(s).toHaveLength(model.bins.length)
      expect(s.every((x) => x.type === 'bar' && x.coordinateSystem === 'polar' && x.stack === 'rose')).toBe(true)
      expect(s.map((x) => x.color)).toEqual(binColors(model.bins.length, t))
      expect(s.map((x) => x.name)).toEqual(model.bins.map((b) => binName(b.label)))
    }
  })
  it('leaves room above the rose for the "N" label under the card title (Now at 390 px: a 17 rem, wider-than-tall chart)', () => {
    const { center, radius } = windRoseChart(model, testCtx('dark')).polar as { center: string[]; radius: string }
    // The rose's top edge, as a share of the chart height when height is the short side.
    const top = parseFloat(center[1]) / 100 - parseFloat(radius) / 100 / 2
    expect(top).toBeGreaterThanOrEqual(0.1)
  })
  it('counts per compass point equal the model; every observation counted once', () => {
    const s = windRoseChart(model, testCtx()).series as Bar[]
    s.forEach((x, i) => expect(x.data).toEqual(model.bins[i].counts))
    expect(s.flatMap((x) => x.data).reduce((a, b) => a + b, 0)).toBe(rows.length)
  })
  it('16-point clockwise angle axis with N centred at the top; 8 labelled points', () => {
    const a = windRoseChart(model, testCtx()).angleAxis as {
      data: string[]
      startAngle: number
      clockwise: boolean
      axisLabel: { formatter: (v: string) => string }
    }
    expect(a.data).toHaveLength(16)
    expect(a.data[0]).toBe('N')
    expect(a.startAngle).toBeCloseTo(101.25)
    expect(a.clockwise).toBe(true)
    expect(a.data.map(a.axisLabel.formatter).filter(Boolean)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
  })
  it('item tooltip escapes text', () => {
    const tip = windRoseChart(model, testCtx()).tooltip as { trigger: string; formatter: (p: unknown) => string }
    expect(tip.trigger).toBe('item')
    expect(tip.formatter({ seriesName: '<b>', name: 'N', value: 3 })).toContain('&lt;b&gt;')
  })
})

describe('title + table', () => {
  it('plain title from the data span; the years only when they differ', () => {
    expect(windRoseTitle(model)).toBe('Wind, Sep 17 – Sep 19')
    expect(windRoseTitle({ ...model, span: ['2025-12-25', '2026-01-07'] })).toBe('Wind, Dec 25, 2025 – Jan 7, 2026')
    expect(windRoseTitle({ ...model, span: null })).toBeNull()
  })
  it('one row per direction, one column per bin', () => {
    const t = windRoseTable(model)
    expect(t.columns).toEqual(['Direction', ...model.bins.map((b) => `${b.label} mph`)])
    expect(t.rows).toHaveLength(16)
    expect(t.rows[0][0]).toBe('N')
    expect(t.caption).toContain('Wind, Sep 17 – Sep 19')
  })
})
