import { describe, expect, it } from 'vitest'
import { cciDaily, etoDaily, etoHourly, feelsLikeDaily } from '../ag/compute'
import { dailyMet, hourlyMet, stationMeta } from '../ag/__tests__/adapters'
import { CCI_CLASSES, ETR, FEELS_LIKE, INDEX_LINE, THEMES, cciColor } from '../palette'
import { ETR_AXIS, ETR_CUM_AXIS, cciChart, cciLegendTitle, cciTable, etrChart, etrTable, feelsLikeChart, feelsLikeTable } from './agMet'
import { testCtx } from './testing'
import { paint } from './theme'

type S = { type: string; name: string; id?: string; data: unknown[][]; yAxisIndex?: number; color: string; symbol?: string }
const series = (o: { series?: unknown }) => o.series as S[]
const ax = (o: { yAxis?: unknown }) => o.yAxis as Record<string, unknown>[]

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
    expect(ETR_AXIS.replace('\n', ' ')).toBe('Reference ET (a=0.23) [in]')
    expect(ETR_CUM_AXIS.replace('\n', ' ')).toBe('Cumulative Reference ET (a=0.23) [in]')
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
    expect(t.columns).toEqual(['Time (MT)', 'Reference ET [in]', 'Cumulative [in]'])
    expect(t.rows).toHaveLength(s.time.length)
    expect(t.rows[0][0]).toBe('2025-07-01 00:00')
  })
})

describe('feelsLikeChart', () => {
  const s = feelsLikeDaily(dailyMet('acebozem', 'winter2526'))
  it('aux index line + one marker series per regime present, in °F, with regime shapes', () => {
    const o = feelsLikeChart({ series: s, period: 'daily' }, testCtx('light'))
    const [line, ...markers] = series(o)
    expect(line).toMatchObject({ type: 'line', id: 'aux:index-line', color: paint(testCtx('light').theme, INDEX_LINE) })
    const present = (['wind_chill', 'heat_index', 'air_temp'] as const).filter((r) => s.regime.includes(r))
    expect(markers.map((m) => m.name)).toEqual(
      present.map((r) => ({ wind_chill: 'Wind Chill', heat_index: 'Heat Index', air_temp: 'Average Temperature' })[r]),
    )
    expect(markers.map((m) => m.symbol)).toEqual(present.map((r) => FEELS_LIKE.light[r].symbol))
    expect(markers.map((m) => m.color)).toEqual(present.map((r) => FEELS_LIKE.light[r].color))
    expect(markers.reduce((a, m) => a + m.data.length, 0)).toBe(s.valueC.filter((v) => v != null).length)
    const i = s.valueC.findIndex((v) => v != null)
    expect(line.data[i][1]).toBeCloseTo((s.valueC[i]! * 9) / 5 + 32, 10)
    expect((o.legend as { data: string[] }).data).not.toContain('Index')
    expect((o.graphic as { style: { text: string } }[])[0].style.text).toBe('Index Used')
  })
  it('table', () => {
    const t = feelsLikeTable({ series: s, period: 'daily' })
    expect(t.columns).toEqual(['Date', 'Feels like [°F]', 'Index used'])
    expect(t.rows).toHaveLength(s.time.length)
  })
})

describe('cciChart', () => {
  const winter = dailyMet('acebozem', 'winter2526')
  it('classes in severity order with palette colors; adult vs newborn differ; legend title', () => {
    const adult = cciChart({ series: cciDaily(winter, 'adult'), period: 'daily' }, testCtx())
    const newborn = cciChart({ series: cciDaily(winter, 'newborn'), period: 'daily' }, testCtx())
    const names = (o: typeof adult) => series(o).slice(1).map((m) => m.name)
    const an = names(adult)
    expect([...an].sort((a, b) => CCI_CLASSES.indexOf(a as never) - CCI_CLASSES.indexOf(b as never))).toEqual(an)
    expect(names(newborn)).not.toEqual(an)
    for (const m of series(adult).slice(1)) expect(m.color).toBe(cciColor(m.name as never, 'dark'))
    expect((newborn.graphic as { style: { text: string } }[])[0].style.text).toBe('Livestock Risk (newborn)')
    expect(cciLegendTitle('adult')).toBe('Livestock Risk (adult)')
  })
  it('table', () => {
    const s = cciDaily(winter, 'adult')
    const t = cciTable({ series: s, period: 'daily' })
    expect(t.columns).toEqual(['Date', 'CCI [°F]', 'Risk class'])
    expect(t.rows[0]).toHaveLength(3)
  })
})
