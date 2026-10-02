import { describe, expect, it } from 'vitest'
import { buildPreviewModel, PREVIEW_PANEL_PX } from '../models/downloaderPreview'
import { previewColor, THEMES } from '../palette'
import { downloaderPreviewChart, downloaderPreviewTable, previewHeight } from './downloaderPreview'
import { testCtx } from './testing'

type S = { type: string; name: string; data: unknown[][]; xAxisIndex: number; yAxisIndex: number; color: string; showSymbol: boolean }
type Ax = { gridIndex: number; name?: string; type: string }

const hourly = buildPreviewModel(
  [0, 1, 2, 3, 6].map((h) => ({
    station: 'acebozem',
    datetime: `2026-09-20 0${h}:00:00-06:00`,
    'Air Temperature @ 2 m [°F]': 50 + h,
    'Relative Humidity [%]': h === 1 ? null : 40.12345,
    'Contains Missing Data': false,
    provisional: false,
  })),
  'hourly',
)!

describe('downloaderPreviewChart', () => {
  it('one grid, axis pair and line per column, linked through one zoom', () => {
    const o = downloaderPreviewChart(hourly, testCtx())
    const s = o.series as S[]
    expect(s.map((x) => [x.type, x.name, x.xAxisIndex, x.yAxisIndex])).toEqual([
      ['line', 'Air Temperature @ 2 m [°F]', 0, 0],
      ['line', 'Relative Humidity [%]', 1, 1],
    ])
    expect((o.grid as unknown[]).length).toBe(2)
    expect((o.xAxis as Ax[]).map((a) => [a.type, a.gridIndex])).toEqual([['time', 0], ['time', 1]])
    expect((o.yAxis as Ax[]).map((a) => a.name)).toEqual(['Air Temperature @ 2 m [°F]', 'Relative Humidity [%]'])
    const zoom = o.dataZoom as { xAxisIndex: number[] }[]
    expect(zoom.every((z) => z.xAxisIndex.join() === '0,1')).toBe(true)
    expect(o.useUTC).toBe(true)
  })

  it('breaks lines at missing hours and nulls', () => {
    const [air, rh] = downloaderPreviewChart(hourly, testCtx()).series as S[]
    expect(air.data.map((p) => p[1])).toEqual([50, 51, 52, 53, null, null, 56])
    expect(rh.data[1][1]).toBeNull()
  })

  it('colors cycle the preview palette per theme', () => {
    for (const t of THEMES) {
      const s = downloaderPreviewChart(hourly, testCtx(t)).series as S[]
      expect(s.map((x) => x.color)).toEqual([previewColor(0, t), previewColor(1, t)])
    }
  })

  it('monthly shows markers and month labels; compact drops the slider', () => {
    const m = buildPreviewModel(
      [{ datetime: '2026-01-01', x: 1 }, { datetime: '2026-02-01', x: 2 }, { datetime: '2026-03-01', x: 3 }],
      'monthly',
    )!
    const o = downloaderPreviewChart(m, testCtx('light', 390, true))
    expect((o.series as S[])[0].showSymbol).toBe(true)
    const x = (o.xAxis as { minInterval?: number; maxInterval?: number }[])[0]
    expect([x.minInterval, x.maxInterval]).toEqual([28 * 86_400_000, 31 * 86_400_000])
    expect((downloaderPreviewChart(hourly, testCtx()).xAxis as { minInterval?: number }[])[0].minInterval).toBeUndefined()
    expect((o.dataZoom as { type: string }[]).map((z) => z.type)).toEqual(['inside'])
  })

  it('grows one panel slot per column', () => {
    expect(previewHeight(hourly, false) - previewHeight(hourly, true)).toBeGreaterThan(0)
    expect(previewHeight(hourly, true)).toBeGreaterThanOrEqual(2 * PREVIEW_PANEL_PX)
  })
})

describe('downloaderPreviewTable', () => {
  it('one row per real timestamp, values to 3 decimals, — for missing', () => {
    const t = downloaderPreviewTable(hourly)
    expect(t.columns).toEqual(['Time (MT)', 'Air Temperature @ 2 m [°F]', 'Relative Humidity [%]'])
    expect(t.rows).toHaveLength(5)
    expect(t.rows[0]).toEqual(['2026-09-20 00:00', '50', '40.123'])
    expect(t.rows[1]).toEqual(['2026-09-20 01:00', '51', '—'])
  })
})
