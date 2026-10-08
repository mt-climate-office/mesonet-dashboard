import { describe, expect, it } from 'vitest'
import type { ObservationRow } from '../api'
import { buildWindRoseModel } from '../models/windRose'
import { THEMES, binColors } from '../palette'
import { testCtx } from './testing'
import { ROSE_SIDE_KEY_MIN_WIDTH, binName, windRoseChart, windRoseLargeChart, windRoseTable, windRoseTitle } from './windRose'

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
  it('radius is the percent of every reading: the model counts over the total; the bars sum to 100% with no calm', () => {
    const s = windRoseChart(model, testCtx()).series as Bar[]
    s.forEach((x, i) => expect(x.data).toEqual(model.bins[i].counts.map((c) => (100 * c) / rows.length)))
    expect(s.flatMap((x) => x.data).reduce((a, b) => a + b, 0)).toBeCloseTo(100)
    expect((windRoseChart(model, testCtx()).radiusAxis as { axisLabel: { formatter: string } }).axisLabel.formatter).toBe('{value}%')
  })
  it('calm readings count in the denominator, so the bars sum to the drawn share', () => {
    const s = windRoseChart({ ...model, calm: 10 }, testCtx()).series as Bar[]
    expect(s.flatMap((x) => x.data).reduce((a, b) => a + b, 0)).toBeCloseTo(50)
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
  it('item tooltip escapes text and gives the share, then the readings behind it', () => {
    const tip = windRoseChart(model, testCtx()).tooltip as { trigger: string; formatter: (p: unknown) => string }
    expect(tip.trigger).toBe('item')
    expect(tip.formatter({ seriesName: '<b>', name: 'N', seriesIndex: 0, dataIndex: 0 })).toContain('&lt;b&gt;')
    // Every bin of this model holds one or two readings of 10.
    const i = model.bins[0].counts.findIndex(Boolean)
    const html = tip.formatter({ seriesName: 'x', name: model.directions[i], seriesIndex: 0, dataIndex: i })
    expect(html).toMatch(/>(10|20)%<\/span> \((1 reading|2 readings)\)/)
  })
})

describe('windRoseLargeChart (the Rose view)', () => {
  it('is the same rose as the card (series, axes); only the layout differs', () => {
    const card = windRoseChart(model, testCtx('light'))
    const large = windRoseLargeChart(model, testCtx('light'))
    expect(large.series).toEqual(card.series)
    expect((large.angleAxis as { data: string[] }).data).toEqual((card.angleAxis as { data: string[] }).data)
  })
  it('wide: the key in a column at the right; narrow: the rose spans the width, the key under it', () => {
    const wide = windRoseLargeChart(model, testCtx('dark', ROSE_SIDE_KEY_MIN_WIDTH))
    expect(wide.legend).toMatchObject({ orient: 'vertical', right: 8 })
    const narrow = windRoseLargeChart(model, testCtx('dark', 342, true, true))
    expect(narrow.legend).toMatchObject({ bottom: 4, left: 'center' })
    expect((narrow.polar as { center: unknown[] }).center).toEqual(['50%', 187])
  })
  it('every reading calm: no series', () => {
    expect(windRoseLargeChart({ ...model, bins: [], n: 0, calm: 3 }, testCtx()).series).toEqual([])
  })
})

describe('title + table', () => {
  it('plain title from the data span; the years only when they differ; "last 24 hours" for that window', () => {
    expect(windRoseTitle(model)).toBe('Wind, Sep 17 – Sep 19')
    expect(windRoseTitle({ ...model, span: ['2025-12-25', '2026-01-07'] })).toBe('Wind, Dec 25, 2025 – Jan 7, 2026')
    expect(windRoseTitle({ ...model, span: null })).toBeNull()
    expect(windRoseTitle(model, true)).toBe('Wind, last 24 hours')
  })
  it('one row per direction (fixed order, N first), one column per bin (its share), then the share', () => {
    const t = windRoseTable(model)
    expect(t.columns).toEqual(['Direction', ...model.bins.map((b) => `${b.label} mph`), 'Share'])
    expect(t.rows).toHaveLength(16)
    expect(t.rows[0][0]).toBe('N')
    expect(t.rows[0].at(-1)).toBe('30%') // 0°, 10° and 355°: 3 of 10
    expect(t.rows[0].slice(1, -1).every((c) => /^(\d+|<1)%$/.test(c))).toBe(true)
    expect(t.fixedOrder).toBe(true)
    expect(t.caption).toBe('Wind, Sep 17 – Sep 19: share of readings by direction and speed')
    expect(windRoseTable(model, true).caption).toMatch(/^Wind, last 24 hours/)
  })
  it('the caption names the calm readings left out', () => {
    expect(windRoseTable({ ...model, calm: 10 }).caption).toBe(
      'Wind, Sep 17 – Sep 19: share of readings by direction and speed; 10 calm readings (under 1 mph, 50%) are not drawn',
    )
  })
})
