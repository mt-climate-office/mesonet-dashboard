import { describe, expect, it } from 'vitest'
import { cciDaily, etoDaily, etoHourly, feelsLikeDaily } from '../ag/compute'
import { dailyMet, hourlyMet, stationMeta } from '../ag/__tests__/adapters'
import { ETR, FEELS_LIKE, INDEX_LINE, THEMES, cciStyle } from '../palette'
import { ETR_AXIS, ETR_CUM_AXIS, FEELS_LIKE_MARKERS, cciChart, cciClassText, cciLegendTitle, cciTable, etrChart, etrTable, feelsLikeChart, feelsLikeTable } from './agMet'
import { drawn, shownY, testCtx } from './testing'
import { paint } from './theme'

type S = { type: string; name: string; id?: string; data: unknown[][]; yAxisIndex?: number; color: string; symbol?: string }
const series = (o: { series?: unknown }) => drawn<S>(o)
const ax = (o: { yAxis?: unknown }) => shownY<Record<string, unknown>>(o)

const met = dailyMet('acebozem', 'season2025')
const eto = etoDaily(met, stationMeta('acebozem'))

describe('etrChart', () => {
  it('bars in inches (y1) + cumulative line (y2); totals match Σ mm / 25.4', () => {
    const o = etrChart({ series: eto, period: 'daily' }, testCtx())
    const [bars, cum] = series(o)
    expect([bars.type, cum.type]).toEqual(['bar', 'line'])
    expect(cum.yAxisIndex).toBe(1)
    const i = eto.etoMm.findIndex((v) => v != null)
    expect(bars.data[i][1]).toBeCloseTo(eto.etoMm[i]! / 25.4, 10)
    const total = eto.etoMm.reduce<number>((a, v) => a + (v ?? 0), 0) / 25.4
    const last = cum.data.filter((p) => p[1] != null).at(-1)!
    expect(last[1]).toBeCloseTo(total, 8)
    expect(o.useUTC).toBe(true)
    expect(ax(o).map((a) => a.name)).toEqual([ETR_AXIS, ETR_CUM_AXIS])
    expect(ETR_AXIS).toBe('Reference ET (in)')
    expect(ETR_CUM_AXIS).toBe('Cumulative reference ET (in)')
  })

  it('colors are the ETR role for each theme', () => {
    for (const t of THEMES) {
      const [bars, cum] = series(etrChart({ series: eto, period: 'daily' }, testCtx(t)))
      expect([bars.color, cum.color]).toEqual([ETR[t].bar, ETR[t].cumulative])
    }
  })

  it('hourly: x on the hour (wall clock), tooltip header shows HH:mm, table rows per hour', () => {
    const s = etoHourly(hourlyMet('acebozem', 'jul2025'), stationMeta('acebozem'))
    const o = etrChart({ series: s, period: 'hourly' }, testCtx())
    expect(series(o)[0].data[0][0]).toBe(Date.UTC(2025, 6, 1, 0))
    const html = (o.tooltip as { formatter: (p: unknown) => string }).formatter([
      { seriesName: 'ETr', seriesId: 'x', value: [Date.UTC(2025, 6, 1, 14), 0.01], axisValue: Date.UTC(2025, 6, 1, 14) },
    ])
    expect(html).toContain('Jul 1, 2025 14:00')
    const t = etrTable({ series: s, period: 'hourly' })
    expect(t.columns).toEqual(['Time (MT)', 'Reference ET (in)', 'Cumulative reference ET (in)'])
    expect(t.rows).toHaveLength(s.time.length)
    expect(t.rows[0][0]).toBe('2025-07-01 00:00')
  })
})

describe('feelsLikeChart', () => {
  const s = feelsLikeDaily(dailyMet('acebozem', 'winter2526'))
  it('aux index line, dashed air temperature, a marker wherever they differ: wind chill blue ◆, heat index red ▲', () => {
    const o = feelsLikeChart({ series: s, period: 'daily' }, testCtx('light'))
    const [index, line, ...markers] = series(o)
    expect(index).toMatchObject({ type: 'line', id: 'aux:index-line', color: paint(testCtx('light').theme, INDEX_LINE) })
    expect(line).toMatchObject({ type: 'line', name: 'Average temperature', lineStyle: { type: 'dashed' } })
    const i = s.airC.findIndex((v) => v != null)
    expect(line.data[i][1]).toBeCloseTo((s.airC[i]! * 9) / 5 + 32, 10)
    expect(index.data[i][1]).toBeCloseTo((s.valueC[i]! * 9) / 5 + 32, 10)
    const present = (['wind_chill', 'heat_index'] as const).filter((r) => s.regime.includes(r))
    expect(present).toContain('wind_chill')
    expect(markers.map((m) => m.name)).toEqual(present.map((r) => FEELS_LIKE_MARKERS[r]))
    expect(markers.map((m) => [m.symbol, m.color])).toEqual(present.map((r) => [FEELS_LIKE.light[r].symbol, FEELS_LIKE.light[r].color]))
    const marked = s.regime.filter((r) => r === 'wind_chill' || r === 'heat_index').length
    expect(markers.reduce((a, m) => a + m.data.length, 0)).toBe(marked)
    // A wind-chill marker sits at or below the air temperature that day.
    const wc = markers.find((m) => m.name === FEELS_LIKE_MARKERS.wind_chill)!
    const j = s.regime.indexOf('wind_chill')
    expect(wc.data[0][1] as number).toBeLessThanOrEqual(line.data[j][1] as number)
    expect((o.legend as { data: unknown[] }).data[0]).toMatchObject({ name: 'Average temperature' })
  })
  it('tooltip names the air temperature and which index the feels-like value is', () => {
    const o = feelsLikeChart({ series: s, period: 'daily' }, testCtx())
    const html = (o.tooltip as { formatter: (p: unknown) => string }).formatter([
      { seriesName: 'Average temperature', seriesId: 'a', value: [0, 20], axisValue: 0 },
      { seriesName: FEELS_LIKE_MARKERS.wind_chill, seriesId: 'b', value: [0, 9.5], axisValue: 0 },
    ])
    expect(html).toContain('Average temperature: ')
    expect(html).toContain('Feels like (wind chill): ')
  })
  it('table', () => {
    const t = feelsLikeTable({ series: s, period: 'daily' })
    expect(t.columns).toEqual(['Date', 'Feels like (°F)', 'Average temperature (°F)', 'Index used'])
    expect(t.rows).toHaveLength(s.time.length)
  })
})

describe('cciChart', () => {
  const winter = dailyMet('acebozem', 'winter2526')
  it('cold classes in blues (◆), heat in reds (▲), ordered cold → hot; adult vs newborn differ', () => {
    const adult = cciChart({ series: cciDaily(winter, 'adult'), period: 'daily' }, testCtx())
    const newborn = cciChart({ series: cciDaily(winter, 'newborn'), period: 'daily' }, testCtx())
    const names = (o: typeof adult) => series(o).slice(1).map((m) => m.name)
    expect(names(adult).every((n) => n === 'No Stress' || n.endsWith('(cold)'))).toBe(true)
    expect(names(newborn)).not.toEqual(names(adult))
    expect(names(newborn).indexOf('No Stress')).toBeGreaterThan(names(newborn).indexOf('Mild (cold)'))
    for (const m of series(adult).slice(1)) {
      const cls = m.name.replace(/ \((cold|heat)\)$/, '')
      expect(m.color).toBe(cciStyle(cls as never, m.name.endsWith('(heat)') ? 'heat' : 'cold', 'dark').color)
    }
    expect((newborn.graphic as { style: { text: string } }[])[0].style.text).toBe('Livestock risk (newborn)')
    expect(cciLegendTitle('adult')).toBe('Livestock risk (adult)')
  })
  it('heat stress is red and on the heat side', () => {
    const o = cciChart({ series: cciDaily(dailyMet('acebozem', 'season2025'), 'adult'), period: 'daily' }, testCtx('light'))
    const heat = series(o).filter((m) => m.name.endsWith('(heat)'))
    expect(heat.length).toBeGreaterThan(0)
    for (const m of heat) for (const p of m.data) expect(p[1] as number).toBeGreaterThanOrEqual(77)
  })
  it('dashed onset lines move with the animal', () => {
    const line = (lt: 'adult' | 'newborn') =>
      (series(cciChart({ series: cciDaily(winter, lt), period: 'daily' }, testCtx()))[0] as unknown as { markLine: { data: { yAxis: number }[] } }).markLine.data.map((d) => d.yAxis)
    expect(line('adult')).toEqual([77, 33])
    expect(line('newborn')).toEqual([77, 42])
  })
  it('table names the side', () => {
    const s = cciDaily(winter, 'adult')
    const t = cciTable({ series: s, period: 'daily' })
    expect(t.columns).toEqual(['Date', 'Livestock risk (°F)', 'Risk class'])
    expect(t.rows[0]).toHaveLength(3)
    expect(cciClassText('Mild', 20)).toBe('Mild (cold)')
    expect(cciClassText('Severe', 100)).toBe('Severe (heat)')
    expect(cciClassText('No Stress', 50)).toBe('No Stress')
  })
})

describe('Ag met charts: the house chart style (style.ts)', () => {
  it('ETr: the slider traces the cumulative (never flat bars), over the bars’ whole extent', () => {
    const o = etrChart({ series: eto, period: 'daily' }, testCtx())
    const trace = (o.series as S[])[0]
    const cum = series(o)[1]
    expect(trace).toMatchObject({ id: 'aux:zoom-trace', yAxisIndex: 2 })
    expect(trace.data.slice(1, -1)).toEqual(cum.data.map((p) => [p[0], p[1]]))
    // Daily bars sit at noon; the axis (and the track) adds half a day each side.
    const x = o.xAxis as { min: number; max: number }
    expect([x.min, x.max]).toEqual([(cum.data[0][0] as number) - 43_200_000, (cum.data.at(-1)![0] as number) + 43_200_000])
    expect([trace.data[0][0], trace.data.at(-1)![0]]).toEqual([x.min, x.max])
  })
  it('feels like: the index line traces the slider; no slider on phones', () => {
    const s = feelsLikeDaily(dailyMet('acebozem', 'winter2526'))
    expect((feelsLikeChart({ series: s, period: 'daily' }, testCtx()).series as S[])[0].id).toBe('aux:zoom-trace')
    const phone = feelsLikeChart({ series: s, period: 'daily' }, testCtx('light', 390, true, true))
    expect((phone.dataZoom as { type: string }[]).map((z) => z.type)).toEqual(['inside'])
    expect(series(phone)[0].id).toBe('aux:index-line')
  })
})
