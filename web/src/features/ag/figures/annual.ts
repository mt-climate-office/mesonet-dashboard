/**
 * Annual comparison: one line per calendar year on a day-of-year axis.
 * Prior years are sampled from Viridis (old → dark, recent → bright); the
 * current year is black, width 3 (legacy `plot_annual`).
 */
import type { Data, Layout } from 'plotly.js'
import { PALETTE_VIRIDIS, sampleSequential } from '../../../lib/params/palettes'
import type { Nullable } from '../contract'
import type { AnnualTrace } from '../compute'
import { cToF, mmToIn, msToMph, kPaToBar } from '../compute'
import { type Figure, baseLayout } from './common'

/**
 * SI → the API's US display unit, keyed by the unit in the API column label
 * (the unit `data/parse.ts` `toSi` converted from). Unknown units were not
 * converted and pass through.
 */
export function fromSi(unit: string | null | undefined): (v: Nullable) => Nullable {
  switch ((unit ?? '').trim()) {
    case '°F':
    case 'degF':
      return (v) => cToF(v)
    case 'mi/h':
    case 'mi/hr':
    case 'mph':
    case 'mi hr^-1':
      return (v) => msToMph(v)
    case 'in':
    case 'in.':
    case 'in/h':
    case 'in/hr':
      return (v) => mmToIn(v)
    case 'bar':
      return (v) => kPaToBar(v)
    case 'ft':
      return (v) => (v == null ? null : v / 0.3048)
    default:
      return (v) => v
  }
}

/** `Total Precipitation [in]` → `{ name: 'Precipitation', unit: 'in' }`. */
export function parseLabel(header: string | null | undefined): { name: string; unit: string | null } {
  if (!header) return { name: '', unit: null }
  const m = /^(?:(?:Minimum|Maximum|Average|Sum|Total)\s+)?(.+?)\s*(?:\[([^\]]+)\])?$/.exec(header.trim())
  return { name: m?.[1] ?? header, unit: m?.[2] ?? null }
}

/** Legacy y label: `Precipitation [in]` → "Annual Cumulative Precipitation [in]". */
export function annualAxisLabel(header: string | null | undefined, cumulative: boolean): string {
  const { name, unit } = parseLabel(header)
  const base = unit ? `${name} [${unit}]` : name
  return cumulative ? `Annual Cumulative ${base}` : base
}

export interface AnnualFigureOptions {
  yLabel: string
  currentYear: number
}

/** `traces` are in display units, one per year, any order. */
export function annualFigure(traces: AnnualTrace[], opts: AnnualFigureOptions): Figure {
  const sorted = [...traces].sort((a, b) => a.year - b.year)
  // Same approach as before Wave 3: one Viridis sample per year (old → dark,
  // recent → bright), with the current year overridden to black.
  const palette = sampleSequential(PALETTE_VIRIDIS, Math.max(2, sorted.length))
  const data: Data[] = sorted.map((t, i) => {
    const isCurrent = t.year === opts.currentYear
    const color = isCurrent ? '#000000' : palette[Math.min(palette.length - 1, i)]
    return {
      type: 'scatter',
      mode: 'lines',
      x: t.doy,
      y: t.values,
      name: String(t.year),
      line: { color, width: isCurrent ? 3 : 1.4 },
      connectgaps: false,
      customdata: t.date as unknown as number[],
      hovertemplate: `<b>Day of year</b>: %{x} (%{customdata})<br>%{y:.2f}<extra>${t.year}</extra>`,
    } as Data
  })
  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'v', x: 1.01, xanchor: 'left', y: 0.99, yanchor: 'top', bgcolor: 'rgba(255,255,255,0.5)' },
    margin: { l: 70, r: 110, t: 30, b: 50 },
    xaxis: { title: { text: 'Day of Year' }, range: [1, 366] },
    yaxis: { title: { text: opts.yLabel } },
  }
  return { data, layout }
}
