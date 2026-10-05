import { describe, expect, it } from 'vitest'
import { percentSaturation, swp } from '../ag/compute'
import { soilParams, soilSeries } from '../ag/__tests__/adapters'
import { profileValues } from '../ag/view/derive'
import { SWP_CAP_BAR, SWP_FIELD_CAPACITY, SWP_WILTING_POINT, depthLabel, swpBar } from '../ag/view/labels'
import { FROZEN, HEATMAP, THEMES, depthColor } from '../palette'
import { FROZEN_NAME, percentSaturationChart, percentSaturationTable, soilProfileChart, soilProfileTable, swpChart, swpTable, type SoilProfileModel } from './agSoil'
import { drawn, shownY, testCtx } from './testing'

type S = { type: string; name: string; id?: string; data: unknown[]; color: string; lineStyle?: { type: string; opacity?: number }; markArea?: { data: [{ yAxis: number; name: string; label: { position: string } }, { yAxis: number }][] }; markLine?: { data: { yAxis: number }[] } }
const series = (o: { series?: unknown }) => drawn<S>(o)
const texts = (o: { graphic?: unknown }) =>
  ((o.graphic ?? []) as { type: string; style?: { text?: string } }[]).filter((g) => g.type === 'text').map((g) => g.style!.text)

const soil = soilSeries('acebozem', 'daily', 'season2025')
const params = soilParams('acebozem')

describe('swpChart', () => {
  const s = swp(soil, params)
  it('inverse log axis with "-" ticks covering FC and WP; bands + dashed lines + corner labels; one line per depth', () => {
    const o = swpChart({ series: s, period: 'daily' }, testCtx())
    const [y] = shownY<{ type: string; inverse: boolean; min: number; max: number; axisLabel: { formatter: (v: number) => string } }>(o)
    expect(y).toMatchObject({ type: 'log', inverse: true })
    expect(y.min).toBeLessThanOrEqual(SWP_FIELD_CAPACITY)
    expect(y.max).toBeGreaterThanOrEqual(SWP_WILTING_POINT)
    expect(y.axisLabel.formatter(10)).toBe('-10')
    const [bands, ...all] = series(o)
    const lines = all.filter((l) => l.lineStyle?.type === 'solid')
    expect(bands.id).toBe('aux:bands')
    expect(bands.markArea!.data.map((b) => [b[0].name, b[0].label.position])).toEqual([
      ['Field Capacity', 'insideTopLeft'],
      ['Wilting Point', 'insideBottomLeft'],
    ])
    expect(bands.markLine!.data.map((l) => l.yAxis)).toEqual([SWP_FIELD_CAPACITY, SWP_WILTING_POINT])
    expect(lines.map((l) => l.name)).toEqual(s.depthsCm.map(depthLabel))
    const i = s.kPa[1].findIndex((v) => v != null)
    expect((lines[1].data[i] as number[])[1]).toBeCloseTo(s.kPa[1][i]! / 100, 10)
    expect((o.legend as { data: string[] }).data).toEqual(s.depthsCm.map(depthLabel))
  })
  it('depth colors are stable palette roles per theme', () => {
    for (const t of THEMES) {
      const lines = series(swpChart({ series: s, period: 'daily' }, testCtx(t))).slice(1).filter((l) => l.lineStyle?.type === 'solid')
      expect(lines.map((l) => l.color)).toEqual(s.depthsCm.map((cm) => depthColor(Number.parseInt(depthLabel(cm)), t)))
    }
  })
  it('dry-end clips: capped, on a dashed faded companion of the same name and color, "≤" in tooltip and table', () => {
    const { bar, dry } = swpBar(s)
    // The fixture season dries 2 in and 40 in past the lab range.
    const dryDepths = s.depthsCm.filter((_, d) => dry[d].some(Boolean))
    expect(dryDepths.map(depthLabel)).toEqual(['2 in', '40 in'])
    const dryVals = bar.flatMap((col, k) => col.filter((v, j) => dry[k][j] && v != null)) as number[]
    expect(dryVals.every((v) => v >= SWP_WILTING_POINT && v <= SWP_CAP_BAR)).toBe(true)
    expect(dryVals).toContain(SWP_CAP_BAR)
    const o = swpChart({ series: s, period: 'daily' }, testCtx())
    const lines = series(o).slice(1)
    const dashed = lines.filter((l) => l.lineStyle?.type === 'dashed')
    expect(dashed.map((l) => l.name)).toEqual(dryDepths.map(depthLabel))
    const d = s.depthsCm.indexOf(dryDepths[0])
    expect(dashed[0].color).toBe(lines.find((l) => l.name === dashed[0].name && l.lineStyle?.type === 'solid')!.color)
    expect(dashed[0].lineStyle!.opacity).toBeLessThan(1)
    const i = dry[d].indexOf(true)
    const pts = dashed[0].data as [number, number | null, string][]
    expect(pts.find((p) => p[0] === pts.filter((q) => q[2] === 'dry')[0][0])![1]).toBe(bar[d][i])
    // The solid line has a gap where the dashed one draws.
    const solid = lines.find((l) => l.name === dashed[0].name && l.lineStyle?.type === 'solid')!.data as [number, number | null][]
    expect(solid.filter((p) => p[1] != null)).toHaveLength(bar[d].filter((v, k) => v != null && !dry[d][k]).length)
    const fmt = (o.tooltip as { formatter: (p: unknown) => string }).formatter
    const tip = (note: string) => fmt([{ seriesName: '2 in', value: [pts[0][0], 1000, note], marker: '', axisValue: pts[0][0] }])
    expect(tip('dry')).toContain('≤ -1000.00 bar (drier than the lab range)')
    expect(tip('joint')).not.toContain('2 in')
    const t = swpTable({ series: s, period: 'daily' })
    expect(t.rows[i][d + 1]).toBe(`≤ -${bar[d][i]!.toFixed(2)}`)
  })
  it('table shows suction as negative bar', () => {
    const t = swpTable({ series: s, period: 'daily' })
    expect(t.columns).toEqual(['Date', ...s.depthsCm.map(depthLabel)])
    expect(t.rows).toHaveLength(s.time.length)
    expect(t.rows.flat().some((c) => /^-\d/.test(c))).toBe(true)
  })
})

describe('percentSaturationChart', () => {
  it('linear 0–100 axis, one line per depth, table', () => {
    const p = percentSaturation(soil, params)
    const o = percentSaturationChart({ series: p, period: 'daily' }, testCtx())
    expect(shownY(o)[0]).toMatchObject({ type: 'value', min: 0, max: 100, interval: 25 })
    expect(series(o).map((l) => l.name)).toEqual(p.depthsCm.map(depthLabel))
    expect(percentSaturationTable({ series: p, period: 'daily' }).rows).toHaveLength(p.time.length)
  })
})

describe('soilProfileChart', () => {
  const base: SoilProfileModel = {
    variable: 'soil_vwc',
    time: ['2026-01-01', '2026-01-02'],
    depthsCm: [5, 10, 20],
    values: [[null, 20], [30, 31], [null, null]],
    frozen: [[true, false], [false, false], [false, false]],
    period: 'daily',
  }
  it('drops all-null depths; category axes with shallow at top; frozen cells hatched in a second series', () => {
    const o = soilProfileChart(base, testCtx('light'))
    const [heat, frozen] = series(o)
    expect(heat.type).toBe('heatmap')
    expect(heat.data).toEqual([[1, 0, 20], [0, 1, 30], [1, 1, 31]])
    expect(shownY(o)[0]).toMatchObject({ type: 'category', data: ['2 in', '4 in'], inverse: true })
    // Category data are wall-clock ms (local noon for daily rows) so the host zooms in ms.
    const x = o.xAxis as { type: string; data: number[]; axisLabel: { formatter: (v: number) => string } }
    expect(x).toMatchObject({ type: 'category', data: [Date.UTC(2026, 0, 1, 12), Date.UTC(2026, 0, 2, 12)] })
    expect(x.axisLabel.formatter(x.data[0])).toBe('Jan 1')
    expect(frozen).toMatchObject({ type: 'custom', name: FROZEN_NAME, data: [[0, 0]], color: FROZEN.light.color })
    expect(o.visualMap).toMatchObject({ seriesIndex: 0, dimension: 2 })
  })
  it('compact: horizontal color bar under the plot, grid bottom clears it', () => {
    const o = soilProfileChart({ ...base, variable: 'soil_temp', values: [[20, 50], [30, 31], [null, null]], frozen: undefined }, testCtx('dark', 390, true))
    const group = (o.graphic as { type: string; bottom: number; children: { type: string; style?: { text?: string }; shape?: { width: number; height: number } }[] }[])[0]
    expect(group.type).toBe('group')
    const bar = group.children.find((c) => c.type === 'rect')!
    expect(bar.shape!.width).toBeGreaterThan(bar.shape!.height)
    expect(group.children.map((c) => c.style?.text)).toContain(HEATMAP.soil_temp.midpointLabel)
    expect((o.grid as { bottom: number; right: number }).bottom).toBeGreaterThan(group.bottom + 40)
    expect((o.grid as { right: number }).right).toBe(16)
  })
  it('soil temperature diverges around 32 °F with the labelled midpoint', () => {
    const o = soilProfileChart({ ...base, variable: 'soil_temp', values: [[20, 50], [30, 31], [null, null]], frozen: undefined }, testCtx())
    const vm = o.visualMap as { min: number; max: number }
    expect((vm.min + vm.max) / 2).toBeCloseTo(32, 10)
    expect(texts(o)).toContain(HEATMAP.soil_temp.midpointLabel)
    expect(series(o)).toHaveLength(1)
  })
  it('SWP: log10(bar), midpoint at the wilting point, FC tick', () => {
    const o = soilProfileChart({ variable: 'swp', time: ['2026-01-01', '2026-01-02'], depthsCm: [5], values: [[10, 0.2]], period: 'daily' }, testCtx())
    expect((series(o)[0].data[0] as number[])[2]).toBeCloseTo(1, 10)
    const vm = o.visualMap as { min: number; max: number }
    expect((vm.min + vm.max) / 2).toBeCloseTo(Math.log10(15), 10)
    expect(texts(o)).toContain('Wilting point (15 bar)')
    expect(texts(o)).toContain('FC (-0.33)')
  })
  it('no data (or frozen-only without a probe) → empty option', () => {
    expect(soilProfileChart({ variable: 'soil_blk_ec', time: ['2026-01-01'], depthsCm: [5], values: [[null]], period: 'daily' }, testCtx()).series).toEqual([])
    expect(
      soilProfileChart({ variable: 'soil_blk_ec', time: ['2026-01-01'], depthsCm: [5], values: [[null]], frozen: [[true]], hasData: [false], period: 'daily' }, testCtx()).series,
    ).toEqual([])
  })
  it('fixture: winter VWC has frozen cells; table marks them', () => {
    const winter = soilSeries('acebozem', 'daily', 'winter2526')
    const pv = profileValues('soil_vwc', winter, {})!
    const m: SoilProfileModel = { variable: 'soil_vwc', time: winter.time, depthsCm: pv.depthsCm, values: pv.values, frozen: pv.frozen, period: 'daily' }
    expect(series(soilProfileChart(m, testCtx()))).toHaveLength(2)
    const t = soilProfileTable(m)
    expect(t.columns).toEqual(['Date', ...pv.depthsCm.map(depthLabel)])
    expect(t.rows).toHaveLength(winter.time.length)
    expect(t.rows.flat()).toContain('frozen')
  })
})

describe('Ag soil charts: the house chart style (style.ts)', () => {
  it('SWP: the slider traces the shallowest depth, wet up (−log10 bar), as the inverted axis draws it', () => {
    const s = swp(soil, params)
    const o = swpChart({ series: s, period: 'daily' }, testCtx())
    const trace = (o.series as S[])[0]
    expect(trace.id).toBe('aux:zoom-trace')
    const top = s.depthsCm.indexOf(Math.min(...s.depthsCm))
    const line = series(o).find((l) => l.name === depthLabel(s.depthsCm[top]))!
    const pts = (d: unknown[]) => d as [number, number | null][]
    const p = pts(line.data).find((q) => q[1] != null && q[1] > 0)!
    // (The trace's first point is the null at the track's start, at the same x.)
    expect(pts(trace.data).findLast((q) => q[0] === p[0])![1]).toBeCloseTo(-Math.log10(p[1]!), 9)
  })
})
