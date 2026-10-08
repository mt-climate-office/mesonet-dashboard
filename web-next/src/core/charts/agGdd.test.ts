import { describe, expect, it } from 'vitest'
import type { DailyNormals, GddSeries } from '../ag/contract'
import { gdd, projectGdd } from '../ag/compute'
import { dailyMet, stageTable } from '../ag/__tests__/adapters'
import { CUMULATIVE_LINE, GDD, GDD_STAGE_LINE, THEMES, gddStageColors } from '../palette'
import { GDD_NAMES, fittedStageLabels, gddAxisMax, gddBarName, gddChart, gddTable, stageGutter, stageIndex, stageLines, stagePieces } from './agGdd'
import { drawn, shownY, testCtx } from './testing'
import { paint } from './theme'

type S = { type: string; name: string; id?: string; data: unknown[][]; yAxisIndex?: number; color: string; markLine?: { data: { yAxis: number; name: string }[] }; lineStyle?: { type: string } }
/** The drawn series without the lines' surface halos (tested on their own). */
const series = (o: { series?: unknown }) => drawn<S>(o).filter((x) => !String(x.id).startsWith('aux:halo'))
const met = dailyMet('acebozem', 'season2025')

function withProjection() {
  const s: GddSeries = gdd(met, { crop: 'hemp', stages: stageTable('hemp') })
  const q = (m: number) => ({ q25: m - 3, median: m, q75: m + 3 })
  const normals: DailyNormals = { station: 'acebozem', byMonthDay: {} }
  for (let d = 0; d < 400; d++) {
    const md = new Date(Date.UTC(2025, 0, 1) + d * 86_400_000).toISOString().slice(5, 10)
    normals.byMonthDay[md] = { tminC: q(8), tmaxC: q(24), prMm: 0, petMm: 0 }
  }
  const last = s.date.at(-1)!
  const fc = [1, 2, 3].map((n) => new Date(Date.parse(`${last}T00:00Z`) + n * 86_400_000).toISOString().slice(0, 10))
  const p = projectGdd(s, normals, { date: fc, tminC: [10, 10, 10], tmaxC: [30, 30, 30], source: 'nws' }, '2025-11-30', stageTable('hemp'))
  return { s, p, last, fc }
}

describe('gddChart on phones', () => {
  it('short legend names in a wrapping legend (series keep theirs); stage lines labelled by code', () => {
    const { s, p } = withProjection()
    const o = gddChart({ series: s, cutoffsF: [41, 86], stageMode: 'table', stages: stageTable('hemp').stages, projection: p }, testCtx('light', 390, true))
    const lg = o.legend as { type: string; data: (string | { name: string })[]; formatter: (n: string) => string }
    const names = lg.data.map((d) => (typeof d === 'string' ? d : d.name))
    expect(lg.type).toBe('plain')
    expect(names.map(lg.formatter)).toEqual(['Daily', 'Cumulative', 'Range', 'Forecast', 'Normals'])
    expect(series(o).map((x) => x.name)).toContain(GDD_NAMES.cumulative)
    const ml = series(o)[1].markLine as unknown as { label: { show: boolean }; data: { name: string }[] }
    expect(ml.data.length).toBeGreaterThan(0)
    expect(ml.label.show).toBe(true)
    // Hemp's "BBCH Stages 12-14" reads "12-14"; the tooltip and table keep the full name.
    expect(ml.data.map((d) => d.name).every((n) => !n.startsWith('BBCH'))).toBe(true)
    const gutter = stageGutter(ml.data.map((d) => ({ label: d.name })), 390)
    expect(gutter).toBeGreaterThan(0)
    expect((o.grid as { right: number }).right).toBe(64 + gutter)
  })
})

describe('gddChart stage labels', () => {
  it('sit in a gutter right of the plot, never on the bars; the cumulative axis moves past it', () => {
    const s = gdd(met, { crop: 'wheat', stages: stageTable('wheat') })
    const o = gddChart({ series: s, cutoffsF: [32, 70], stageMode: 'table', stages: stageTable('wheat').stages }, testCtx('light', 1400))
    const ml = series(o)[1].markLine as unknown as { label: { show: boolean; position: string }; data: { name: string }[] }
    expect(ml.label).toMatchObject({ show: true, position: 'end' })
    const gutter = stageGutter(ml.data.map((d) => ({ label: d.name })), 1400)
    expect(gutter).toBeGreaterThan(0)
    expect((o.grid as { right: number }).right).toBe(64 + gutter)
    expect(shownY<{ offset?: number }>(o)[1].offset).toBe(gutter)
  })
  it('stageGutter: 0 with no lines or when the longest label takes over a quarter of the chart', () => {
    expect(stageGutter([], 1400)).toBe(0)
    const long = [{ label: '11 – Headed (Head Extension Begins)' }]
    expect(stageGutter(long, 1400)).toBeGreaterThan(150)
    expect(stageGutter(long, 720)).toBe(0)
  })
  it('fittedStageLabels: full names when they fit, else the stage codes, else none', () => {
    const lines = [{ y: 538, label: '3 – Leaf 3 (Tillers Begin To Emerge)', short: '3' }]
    expect(fittedStageLabels(lines, 1400).lines[0].label).toBe(lines[0].label)
    const phone = fittedStageLabels(lines, 390)
    expect(phone.lines[0].label).toBe('3')
    expect(phone.gutter).toBeGreaterThan(0)
    expect(fittedStageLabels([{ y: 1, label: 'x'.repeat(80), short: 'y'.repeat(80) }], 390).gutter).toBe(0)
  })
})

describe('gddChart', () => {
  it('bars + cumulative on y2 with stage lines from the table; bars colored by growth stage, stage lines neutral', () => {
    const s = gdd(met, { crop: 'wheat', stages: stageTable('wheat') })
    const stages = stageTable('wheat').stages
    for (const t of THEMES) {
      const ctx = testCtx(t)
      const o = gddChart({ series: s, cutoffsF: [32, 70], stageMode: 'table', stages }, ctx)
      const [bars, cum] = series(o)
      expect([bars.type, cum.type, cum.yAxisIndex]).toEqual(['bar', 'line', 1])
      const colors = gddStageColors(stages.length + 1, t)
      // The bars (and so the legend) carry the stage reached by the last day; the running total is
      // the text color, so it never vanishes into the bars.
      const now = stageIndex([...stages].sort((a, b) => a.gdd - b.gdd), s.cumulative.filter((v) => v != null).at(-1)!)!
      expect([bars.color, cum.color]).toEqual([colors[now], paint(ctx.theme, CUMULATIVE_LINE)])
      expect(bars.name).toBe('Daily GDDs (32–70 °F)')
      // One neutral stroke above the bars: a stage-colored line vanished across bars of its stage.
      const ml = cum.markLine as unknown as { z: number; lineStyle: { color: string }; data: { yAxis: number; lineStyle?: unknown }[] }
      expect(ml.data.length).toBeGreaterThan(0)
      expect(ml.lineStyle.color).toBe(paint(ctx.theme, GDD_STAGE_LINE))
      expect(ml.z).toBeGreaterThan(2)
      for (const d of ml.data) expect(d.lineStyle).toBeUndefined()
      const vm = o.visualMap as { type: string; dimension: number; seriesIndex: number[]; pieces: { color: string }[] }
      expect(vm).toMatchObject({ type: 'piecewise', dimension: 0 })
      const all = o.series as S[]
      expect(vm.seriesIndex.map((i) => all[i].name)).toEqual([bars.name])
      expect(new Set(vm.pieces.map((p) => p.color)).size).toBeGreaterThan(3)
    }
  })

  it('the cumulative and projected lines each ride on a wider surface-colored halo drawn just before them', () => {
    const { s, p } = withProjection()
    for (const t of THEMES) {
      const ctx = testCtx(t)
      const all = drawn<S & { lineStyle: { color: string; width: number }; silent?: boolean }>(gddChart({ series: s, cutoffsF: [32, Infinity], stageMode: 'table', stages: stageTable('hemp').stages, projection: p }, ctx))
      for (const name of [GDD_NAMES.cumulative, GDD_NAMES.forecast, GDD_NAMES.normals]) {
        const i = all.findIndex((x) => x.name === name)
        const h = all[i - 1]
        expect(h.id).toMatch(/^aux:halo/)
        expect(h.lineStyle.color).toBe(ctx.theme.surface)
        expect(h.lineStyle.width).toBeGreaterThan(all[i].lineStyle.width ?? 1.5)
        expect(h.data).toEqual(all[i].data)
        expect(h.silent).toBe(true)
      }
      // The cumulative halo also carries a solid surface underlay under each stage line.
      const under = all.find((x) => x.id === `aux:halo-${GDD_NAMES.cumulative}`)!.markLine as unknown as { lineStyle: { color: string; type: string }; data: { yAxis: number }[] }
      const stage = all.find((x) => x.name === GDD_NAMES.cumulative)!.markLine!
      expect(under.lineStyle).toMatchObject({ color: ctx.theme.surface, type: 'solid' })
      expect(under.data.map((d) => d.yAxis)).toEqual(stage.data.map((d) => d.yAxis))
      // The band has no line, so no halo.
      expect(all.filter((x) => String(x.id).startsWith('aux:halo'))).toHaveLength(3)
    }
  })

  it('no stage table (corn) or custom cutoffs: the GDD palette and no visualMap', () => {
    const corn = gddChart({ series: gdd(met, { crop: 'corn', stages: { crop: 'corn', stages: [] } }), cutoffsF: [50, 86], stageMode: 'no-table', cropLabel: 'Corn' }, testCtx('light'))
    const [bars, cum] = series(corn)
    expect([bars.color, cum.color]).toEqual([GDD.light.bar, paint(testCtx('light').theme, CUMULATIVE_LINE)])
    expect(corn.visualMap).toBeUndefined()
    const custom = gddChart({ series: gdd(met, { crop: 'wheat', lowC: 0, highC: 30 }), cutoffsF: [32, 86], stageMode: 'custom', stages: stageTable('wheat').stages }, testCtx())
    expect(custom.visualMap).toBeUndefined()
    expect((series(custom)[1].markLine as unknown as { lineStyle: { color: string } } | undefined)?.lineStyle.color ?? paint(testCtx().theme, GDD_STAGE_LINE)).toBe(paint(testCtx().theme, GDD_STAGE_LINE))
  })

  it('stagePieces: one whole-day run per stage; a missing total keeps the stage', () => {
    const st = [{ stage: 1, name: 'a', description: null, gdd: 10 }, { stage: 2, name: 'b', description: null, gdd: 20 }]
    expect(stageIndex(st, 9)).toBe(0)
    expect(stageIndex(st, 10)).toBe(1)
    expect(stageIndex(st, null)).toBeNull()
    const day = (d: string) => Date.parse(`${d}T00:00Z`)
    const p = stagePieces(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'], [5, 12, null, 25], st, ['c0', 'c1', 'c2'])
    expect(p).toEqual([
      { gte: day('2026-05-01'), lt: day('2026-05-02'), color: 'c0' },
      { gte: day('2026-05-02'), lt: day('2026-05-04'), color: 'c1' },
      { gte: day('2026-05-04'), lt: day('2026-05-05'), color: 'c2' },
    ])
  })

  it('tooltip notes: stage text, "No stage table for corn", "n/a (custom cutoffs)"', () => {
    const notes = (o: ReturnType<typeof gddChart>) => new Set(series(o)[1].data.filter((p) => p.length === 3).map((p) => p[2]))
    const wheat = gddChart({ series: gdd(met, { crop: 'wheat', stages: stageTable('wheat') }), cutoffsF: [32, 70], stageMode: 'table' }, testCtx())
    expect([...notes(wheat)].some((n) => /Leaf/.test(String(n)))).toBe(true)
    const corn = gddChart({ series: gdd(met, { crop: 'corn', stages: { crop: 'corn', stages: [] } }), cutoffsF: [50, 86], stageMode: 'no-table', cropLabel: 'Corn' }, testCtx())
    expect(notes(corn)).toEqual(new Set(['No stage table for corn']))
    const custom = gddChart({ series: gdd(met, { crop: 'wheat', lowC: 0, highC: 30 }), cutoffsF: [32, 86], stageMode: 'custom' }, testCtx())
    expect(notes(custom)).toEqual(new Set(['n/a (custom cutoffs)']))
  })

  it('projection: q25 base (aux), band, forecast from the last observed day, normals from the last forecast day', () => {
    const { s, p, last, fc } = withProjection()
    const o = gddChart({ series: s, cutoffsF: [32, Infinity], stageMode: 'table', projection: p }, testCtx())
    const ss = series(o)
    expect(ss.map((x) => x.name)).toEqual(['Daily GDDs (32–∞ °F)', GDD_NAMES.cumulative, GDD_NAMES.q25, GDD_NAMES.band, GDD_NAMES.forecast, GDD_NAMES.normals])
    expect(ss[2].id).toMatch(/^aux:/)
    const day = (d: string) => Date.parse(`${d}T12:00Z`)
    expect(ss[4].data[0][0]).toBe(day(last))
    expect(ss[4].data).toHaveLength(4)
    expect(ss[4].lineStyle!.type).toBe('dotted')
    expect(ss[5].data[0][0]).toBe(day(fc[2]))
    expect(ss[5].data.at(-1)![0]).toBe(day('2025-11-30'))
    expect(ss[5].lineStyle!.type).toBe('dashed')
    const y2 = shownY<{ max?: number }>(o)[1]
    expect(y2.max).toBe(gddAxisMax({ series: s, cutoffsF: [32, 1], stageMode: 'table', projection: p }))
    expect(y2.max!).toBeGreaterThanOrEqual(p.cumulativeQ75.at(-1)!)
    expect((o.legend as { data: unknown[] }).data).not.toContain(GDD_NAMES.q25)
  })

  it('stage lines are thinned so labels never stack; the stage reached and the highest stay', () => {
    const st = (stage: number, gdd: number, name = String.fromCharCode(96 + stage)) => ({ stage, name, description: null, gdd })
    const lines = stageLines([st(1, 100), st(2, 110), st(3, 900)], 1600)
    expect(lines.map((l) => l.y)).toEqual([100, 900])
    expect(lines[0]).toMatchObject({ label: '1 – a', short: '1' })
    // Wheat-like crowding at the top: 1539–1825 within y2max / 16 of each other.
    const top = [st(1, 180), st(9, 1396), st(10, 1539), st(11, 1682), st(12, 1739), st(13, 1825)]
    expect(stageLines(top, 5000).map((l) => l.y)).toEqual([180, 1396, 1825])
    // The stage reached (11: 1682 so far) stays, and its neighbours give way.
    expect(stageLines(top, 5000, 1700).map((l) => l.y)).toEqual([180, 1682, 1825])
    expect(gddBarName([50, 86])).toBe('Daily GDDs (50–86 °F)')
    expect(gddBarName([32, 70], 95)).toBe('Daily GDDs (32–70/95 °F)')
  })

  it('table: observed then projected rows', () => {
    const { s, p } = withProjection()
    const t = gddTable({ series: s, cutoffsF: [32, Infinity], stageMode: 'table', projection: p })
    expect(t.columns).toEqual(['Date', 'Source', 'Daily GDD (°F)', 'Cumulative GDD (°F)', 'Growth stage'])
    expect(t.rows).toHaveLength(s.date.length + p.date.length)
    expect(t.rows.at(-1)![1]).toBe('Projected (normals median)')
  })
})
