/**
 * Soil figures: SWP and percent-saturation lines per depth, and the Soil
 * Profile heatmap (VWC / temperature / EC / SWP / saturation by depth).
 * Visual design (Viridis depth ramp, FC/WP bands, heatmap palettes) is the
 * pre-Wave-3 DerivedChart's.
 */
import type { Data, Layout } from 'plotly.js'
import { PALETTE_VIRIDIS, sampleSequential } from '../../../lib/params/palettes'
import type { LocalDate, LocalDateTime, Nullable, PercentSaturationSeries, SwpSeries } from '../contract'
import { kPaToBar } from '../compute'
import { type Figure, type Period, baseLayout, depthLabel, hoverDate, insertGapsColumnar, xValues } from './common'

/* ------------------------------------------------------------------ SWP */

// Positive bar magnitudes; the axis is log, reversed, with a "-" tick prefix.
export const SWP_FIELD_CAPACITY = 0.33
export const SWP_WILTING_POINT = 15

function depthLines(
  epochMs: number[],
  time: (LocalDate | LocalDateTime)[],
  depthsCm: number[],
  values: Nullable[][],
  period: Period,
  fmt: string,
): Data[] {
  const x = xValues(time)
  const colors = sampleSequential(PALETTE_VIRIDIS, depthsCm.length || 1)
  return depthsCm.map((cm, d) => {
    const label = depthLabel(cm)
    const line = insertGapsColumnar(epochMs, x, [values[d]])
    return {
      type: 'scatter',
      mode: 'lines',
      x: line.x,
      y: line.ys[0],
      name: label,
      line: { color: colors[d] ?? '#555', width: 2 },
      connectgaps: false,
      hovertemplate: `<b>${hoverDate(period)}</b><br>${fmt}<extra>${label}</extra>`,
    } as Data
  })
}

export function swpFigure(series: SwpSeries, period: Period): Figure {
  const x = xValues(series.time)
  const bar = series.kPa.map((col) => col.map((v) => kPaToBar(v)))
  const traces: Data[] = []
  if (x.length > 0) {
    const flat = (y: number) => x.map(() => y)
    const band = { mode: 'lines', x, hoverinfo: 'skip', showlegend: false, line: { color: 'rgba(0,0,0,0)', width: 0 } }
    traces.push(
      { type: 'scatter', ...band, y: flat(SWP_FIELD_CAPACITY), fill: 'tozeroy', fillcolor: 'rgba(150,150,150,0.18)', name: 'Saturated → Field Capacity' } as Data,
      { type: 'scatter', ...band, y: flat(1000), name: 'Beyond Wilting Point' } as Data,
      { type: 'scatter', ...band, y: flat(SWP_WILTING_POINT), fill: 'tonexty', fillcolor: 'rgba(150,150,150,0.18)', name: 'Beyond Wilting Point' } as Data,
      { type: 'scatter', mode: 'lines', x, y: flat(SWP_FIELD_CAPACITY), line: { color: '#444', width: 1, dash: 'dash' }, name: `Field Capacity (${SWP_FIELD_CAPACITY} bar)`, hoverinfo: 'skip' } as Data,
      { type: 'scatter', mode: 'lines', x, y: flat(SWP_WILTING_POINT), line: { color: '#444', width: 1, dash: 'dash' }, name: `Wilting Point (${SWP_WILTING_POINT} bar)`, hoverinfo: 'skip' } as Data,
    )
  }
  traces.push(...depthLines(series.epochMs, series.time, series.depthsCm, bar, period, '-%{y:.2f} bar'))
  // Legacy plot_swp (plot_derived.py ~517-548): boxed labels in the top-left
  // (wet end; the axis is reversed) and bottom-left (dry end) corners.
  const note = (text: string, y: 0 | 1) => ({
    text,
    x: 0,
    y,
    xref: 'paper' as const,
    yref: 'paper' as const,
    showarrow: false,
    align: 'left' as const,
    font: { size: 14, color: 'black' },
    bgcolor: 'rgba(255,255,255,0.8)',
    bordercolor: 'black',
    borderwidth: 2,
    borderpad: 4,
  })
  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'h', y: -0.2 },
    yaxis: {
      title: { text: '<b>Soil Water Potential [bar]</b>' },
      type: 'log',
      autorange: 'reversed',
      tickprefix: '-',
    },
    xaxis: { type: 'date' },
    annotations: [note('Field Capacity', 1), note('Wilting Point', 0)],
  }
  return { data: traces, layout }
}

export function percentSaturationFigure(series: PercentSaturationSeries, period: Period): Figure {
  return {
    data: depthLines(series.epochMs, series.time, series.depthsCm, series.pct, period, '%{y:.1f} %'),
    layout: {
      ...baseLayout,
      showlegend: true,
      legend: { orientation: 'h', y: -0.2 },
      yaxis: { title: { text: '<b>Percent Saturation [%]</b>' } },
      xaxis: { type: 'date' },
    },
  }
}

/* ------------------------------------------------------- Soil profile */

export type SoilProfileVar = 'soil_vwc' | 'soil_temp' | 'soil_blk_ec' | 'swp' | 'percent_saturation'

const PALETTE_HEATMAP_VIRIDIS: Array<[number, string]> = [
  [0.0, '#440154'],
  [0.125, '#46327E'],
  [0.25, '#365C8D'],
  [0.375, '#277F8E'],
  [0.5, '#1FA187'],
  [0.625, '#4AC16D'],
  [0.75, '#9FDA3A'],
  [0.875, '#FDE725'],
  [1.0, '#FDE725'],
]
// Cool → warm with a neutral midpoint at 32 °F (freezing).
const PALETTE_HEATMAP_DIVERGING: Array<[number, string]> = [
  [0.0, '#3B4CC0'],
  [0.25, '#7AA1FF'],
  [0.5, '#DDDDDD'],
  [0.75, '#F49A7B'],
  [1.0, '#B40426'],
]

const PROFILE_META: Record<SoilProfileVar, { label: string; units: string; scale: Array<[number, string]>; mid?: number; reverse?: boolean }> = {
  soil_vwc: { label: 'Soil VWC [%]', units: '%', scale: PALETTE_HEATMAP_VIRIDIS },
  soil_temp: { label: 'Soil Temperature [°F]', units: '°F', scale: PALETTE_HEATMAP_DIVERGING, mid: 32 },
  soil_blk_ec: { label: 'Soil Electrical Conductivity [mS/cm]', units: 'mS/cm', scale: PALETTE_HEATMAP_VIRIDIS },
  swp: { label: 'Soil Water Potential [bar]', units: 'bar', scale: PALETTE_HEATMAP_VIRIDIS, reverse: true },
  percent_saturation: { label: 'Percent Saturation [%]', units: '%', scale: PALETTE_HEATMAP_VIRIDIS },
}

export interface SoilProfileInput {
  variable: SoilProfileVar
  time: (LocalDate | LocalDateTime)[]
  depthsCm: number[]
  /** Display units (°F, %, mS/cm, bar), already frozen-masked; `values[d][i]`. */
  values: Nullable[][]
  /** `frozen[d][i]`: cells hidden by the frozen-soil mask (drawn grey). */
  frozen?: boolean[][]
  /**
   * `hasData[d]`: the variable had a value at depth `d` before masking. A
   * depth without data is dropped even when frozen cells exist there (no EC
   * probe ≠ frozen EC). Defaults to "has data" when omitted.
   */
  hasData?: boolean[]
  period: Period
}

/**
 * Depth × time heatmap. Depths that are entirely missing are dropped. SWP is
 * drawn on log10(bar) with raw-bar hover and FC/WP colorbar ticks. Frozen
 * cells (soil ≤ 32 °F) are drawn as a separate light-grey layer so the mask
 * is visible rather than reading as missing data.
 */
export function soilProfileFigure(input: SoilProfileInput): Figure {
  const meta = PROFILE_META[input.variable]
  const keep = input.depthsCm
    .map((_, d) => d)
    .filter(
      (d) =>
        input.hasData?.[d] !== false &&
        (input.values[d].some((v) => v != null) || !!input.frozen?.[d]?.some(Boolean)),
    )
  if (keep.length === 0 || input.time.length === 0) return { data: [], layout: { ...baseLayout } }

  const x = xValues(input.time)
  const y = keep.map((d) => depthLabel(input.depthsCm[d]))
  const raw = keep.map((d) => input.values[d])
  const isLog = input.variable === 'swp'
  const z = isLog ? raw.map((row) => row.map((v) => (v != null && v > 0 ? Math.log10(v) : null))) : raw

  let mn = Infinity
  let mx = -Infinity
  for (const row of z)
    for (const v of row)
      if (v != null) {
        if (v < mn) mn = v
        if (v > mx) mx = v
      }
  const mid = meta.mid ?? (Number.isFinite(mn) && Number.isFinite(mx) ? (mn + mx) / 2 : 0)

  const traces: Data[] = [
    {
      type: 'heatmap',
      x,
      y,
      z,
      customdata: raw as unknown as number[][],
      colorscale: meta.scale,
      reversescale: !!meta.reverse,
      zmid: mid,
      colorbar: isLog
        ? {
            title: { text: meta.label, side: 'right' as const },
            tickvals: [-1, Math.log10(SWP_FIELD_CAPACITY), 0, 1, Math.log10(SWP_WILTING_POINT), 2, 3],
            ticktext: ['0.1', 'FC (0.33)', '1', '10', 'WP (15)', '100', '1000'],
          }
        : { title: { text: meta.label, side: 'right' as const } },
      hovertemplate:
        `<b>${hoverDate(input.period)}</b><br><b>Depth</b>: %{y}<br><b>Value</b>: ` +
        (isLog ? '-%{customdata:.2f}' : '%{z:.2f}') +
        ` ${meta.units}<extra></extra>`,
    } as Data,
  ]
  const frozen = input.frozen ? keep.map((d) => input.frozen![d] ?? []) : []
  if (frozen.some((row) => row.some(Boolean))) {
    traces.push({
      type: 'heatmap',
      x,
      y,
      z: frozen.map((row) => row.map((f) => (f ? 1 : null))),
      colorscale: [
        [0, '#D9D9D9'],
        [1, '#D9D9D9'],
      ],
      showscale: false,
      name: 'Frozen soil',
      hovertemplate: `<b>${hoverDate(input.period)}</b><br><b>Depth</b>: %{y}<br>Frozen soil (≤ 32 °F): value hidden<extra></extra>`,
    } as Data)
  }
  const layout: Partial<Layout> = {
    ...baseLayout,
    yaxis: { title: { text: '<b>Soil Depth</b>' }, autorange: 'reversed', type: 'category' },
    xaxis: { type: 'date' },
  }
  return { data: traces, layout }
}
