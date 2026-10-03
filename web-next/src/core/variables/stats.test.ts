import { describe, expect, it } from 'vitest'
import type { TimeseriesPanel } from '../models/timeseries'
import { fmtStat, panelStats } from './stats'

const panel = (series: { name: string; depth?: string; values: (number | null)[] }[]): TimeseriesPanel => ({
  variable: 'X',
  axisTitle: 'X',
  isSoil: false,
  noData: false,
  yRange: null,
  legend: false,
  series: series.map((s) => ({ name: s.name, type: 'line', depth: s.depth ?? null, values: s.values, hoverLabel: s.name })),
  normals: null,
  sensorSpans: [],
})

describe('panelStats', () => {
  const x = [0, 10, 20, 30]
  it('min / max / mean over the view, with the unit', () => {
    const [row] = panelStats(panel([{ name: 'Air Temperature [°F]', values: [40, 50, null, 99] }]), x, [0, 30], false)
    expect(row).toEqual({
      label: '',
      items: [
        { label: 'Min', value: '40 °F' },
        { label: 'Max', value: '50 °F' },
        { label: 'Mean', value: '45 °F' },
      ],
    })
  })
  it('a total for summed variables', () => {
    const [row] = panelStats(panel([{ name: 'Precipitation [in]', values: [0.1, 0.25, 0, 1] }]), x, [0, 25], true)
    expect(row.items).toEqual([{ label: 'Total', value: '0.35 in' }])
  })
  it('one row per depth, "—" without values', () => {
    const rows = panelStats(panel([
      { name: 'Soil VWC @ 2 in [%]', depth: '2 in', values: [10, 11, 12, 13] },
      { name: 'Soil VWC @ 4 in [%]', depth: '4 in', values: [null, null, null, null] },
    ]), x, [0, 40], false)
    expect(rows.map((r) => r.label)).toEqual(['2 in', '4 in'])
    expect(rows[1].items[0].value).toBe('—')
  })
  it('formats by magnitude', () => {
    expect([0.0349, 5.678, 56.78, 848.93, -12.34].map(fmtStat)).toEqual(['0.03', '5.68', '56.8', '849', '-12.3'])
  })
})
