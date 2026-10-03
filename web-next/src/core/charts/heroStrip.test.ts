import { describe, expect, it } from 'vitest'
import { HERO_STRIP, THEMES, variableStyle, withAlpha } from '../palette'
import { heroStripChart, heroStripTable, stripTickLabel, stripTicks, type HeroStripModel } from './heroStrip'
import { paint } from './theme'
import { testCtx } from './testing'

const H = 3_600_000
const NOW = Date.UTC(2026, 9, 2, 14)
const obsT = Array.from({ length: 24 }, (_, i) => NOW - (23 - i) * H)
const MODEL: HeroStripModel = {
  observed: { t: obsT, v: obsT.map((_, i) => (i === 5 ? 38 : i === 20 ? 66 : 50)) },
  forecast: { t: [NOW + H, NOW + 2 * H, NOW + 10 * H], v: [60, 58, 45] },
  now: { t: NOW, v: 62 },
  periods: [{ t: NOW + 10 * H, label: 'Tonight 45°', icon: null, short: 'Clear' }],
}

type S = {
  type: string
  id?: string
  name?: string
  data: unknown[]
  lineStyle?: { type: string; color: string }
  areaStyle?: { color: string }
  markLine?: { data: { xAxis: number }[]; lineStyle: { color: string } }
}
const series = (m = MODEL, ctx = testCtx()) => heroStripChart(m, ctx).series as S[]

describe('heroStripChart', () => {
  it('observed solid with an area fill, forecast dashed from the now point', () => {
    const [obs, fc] = series()
    expect(obs).toMatchObject({ type: 'line', name: 'Observed', lineStyle: { type: 'solid' } })
    expect(obs.areaStyle).toBeDefined()
    expect(fc).toMatchObject({ type: 'line', name: 'Forecast', lineStyle: { type: 'dashed' } })
    expect(fc.data[0]).toEqual([NOW, 62])
    expect(fc.data.at(-1)).toEqual([NOW + 10 * H, 45])
  })
  it('now marker: a vertical rule and a dot at the newest observation', () => {
    const now = series().find((s) => s.id === 'aux:now')!
    expect(now.data).toEqual([[NOW, 62]])
    expect(now.markLine?.data).toEqual([{ xAxis: NOW }])
  })
  it('x spans 24 h either side of now; no dataZoom', () => {
    const o = heroStripChart(MODEL, testCtx())
    expect(o.xAxis).toMatchObject({ type: 'time', min: NOW - 24 * H, max: NOW + 24 * H })
    expect(o.dataZoom).toBeUndefined()
  })
  it('labels the observed high above its point and the low below; no period labels in the chart', () => {
    const ext = series().find((s) => s.id === 'aux:extremes')!.data as { value: number[]; label: { formatter: string; position: string } }[]
    expect(ext.map((d) => [d.value, d.label.formatter, d.label.position])).toEqual([
      [[obsT[20], 66], 'High 66°', 'top'],
      [[obsT[5], 38], 'Low 38°', 'bottom'],
    ])
    expect(series().find((s) => s.id === 'aux:periods')).toBeUndefined()
  })
  it('pads the y range so the high and low labels stay inside the grid', () => {
    const y = heroStripChart(MODEL, testCtx()).yAxis as { min: number; max: number }
    // values span 38–66 (28°): 30% pad ≈ 8.4° each side
    expect(y.min).toBe(29)
    expect(y.max).toBe(75)
  })
  it('x ticks: Now plus every 6 h on phones, every 3 h wider, none crowding Now', () => {
    const ticks = (compact: boolean) => {
      const x = heroStripChart(MODEL, testCtx('dark', compact ? 390 : 900, compact)).xAxis as { axisLabel: { customValues: number[] } }
      return x.axisLabel.customValues.map((t) => stripTickLabel(t, NOW))
    }
    // NOW is 14:00 wall clock: Noon (2 h before) would crowd Now.
    expect(ticks(true)).toEqual(['6 PM', '12 AM', '6 AM', 'Now', '6 PM', '12 AM', '6 AM', 'Noon'])
    expect(ticks(false)).toHaveLength(16)
    const wide = ticks(false)
    expect(wide.slice(wide.indexOf('Now') - 1, wide.indexOf('Now') + 2)).toEqual(['Noon', 'Now', '6 PM'])
    expect(stripTicks(0, 12 * H, 5 * H, 6)).toEqual([0, 5 * H, 12 * H])
  })
  it('palette colors per theme', () => {
    for (const t of THEMES) {
      const ctx = testCtx(t)
      const [obs, fc, now] = series(MODEL, ctx)
      const c = variableStyle('Air Temperature', t)!.color
      expect(obs.lineStyle?.color).toBe(c)
      expect(fc.lineStyle?.color).toBe(c)
      expect(obs.areaStyle?.color).toBe(withAlpha(c, HERO_STRIP.areaAlpha))
      expect(now.markLine?.lineStyle.color).toBe(paint(ctx.theme, HERO_STRIP.nowRule))
    }
  })
  it('no forecast and no current reading: observed only, no dot', () => {
    const m = { ...MODEL, forecast: { t: [], v: [] }, now: { t: NOW, v: null }, periods: [] }
    const s = series(m)
    expect(s[1].data).toEqual([])
    expect(s.find((x) => x.id === 'aux:now')!.data).toEqual([])
  })
  it('tap-triggered tooltip on touch', () => {
    expect(heroStripChart(MODEL, testCtx('dark', 390, true, true)).tooltip).toMatchObject({ triggerOn: 'click', trigger: 'axis' })
  })
})

describe('heroStripTable', () => {
  it('one row per hour, observed then forecast, periods in the caption', () => {
    const t = heroStripTable(MODEL)
    expect(t.columns).toEqual(['Time (MT)', 'Observed [°F]', 'Forecast [°F]'])
    expect(t.rows).toHaveLength(27)
    expect(t.rows[23]).toEqual(['2026-10-02 14:00', '50', '—'])
    expect(t.rows[24]).toEqual(['2026-10-02 15:00', '—', '60'])
    expect(t.caption).toContain('Forecast periods: Tonight 45°')
  })
})
