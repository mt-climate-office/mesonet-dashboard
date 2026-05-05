import { useMemo } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import type { Data, Layout } from 'plotly.js'
import { Plot } from '../../lib/plotly'
import { PLOT_CONFIG } from '../../lib/plotConfig'
import {
  CCI_RISK_COLORS,
  GDD_STAGE_COLORS,
  PALETTE_VIRIDIS,
  sampleSequential,
} from '../../lib/params'
import type { ObservationRow } from '../../lib/api'

/* -------------------------------------------------------------------------- */
/* Helper utilities                                                           */
/* -------------------------------------------------------------------------- */

const baseLayout: Partial<Layout> = {
  autosize: true,
  margin: { l: 70, r: 70, t: 30, b: 50 },
  hovermode: 'x',
  plot_bgcolor: 'rgba(0,0,0,0)',
  paper_bgcolor: 'rgba(0,0,0,0)',
  font: { size: 12 },
}

const numCol = (data: ObservationRow[], col: string): Array<number | null> =>
  data.map((r) => {
    const v = (r as Record<string, unknown>)[col]
    return typeof v === 'number' ? v : null
  })

const datesOf = (data: ObservationRow[]): string[] =>
  data.map((r) => r.datetime as string)

/* -------------------------------------------------------------------------- */
/* ETR chart — bar of daily Reference ET + cumulative line on secondary axis  */
/* -------------------------------------------------------------------------- */

function buildEtrFigure(data: ObservationRow[]) {
  const sorted = [...data].sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime)),
  )
  const x = datesOf(sorted)
  const y = numCol(sorted, 'Reference ET (a=0.23) [in]')
  let cum = 0
  const cumulative = y.map((v) => {
    if (v != null) cum += v
    return cum
  })

  const traces: Data[] = [
    {
      type: 'bar',
      x,
      y,
      marker: { color: 'red' },
      name: 'ETr',
      hovertemplate:
        '<b>Date</b>: %{x|%b %d, %Y}<br><b>Reference ET</b>: %{y:.3f}<extra></extra>',
    } as Data,
    {
      type: 'scatter',
      mode: 'lines',
      x,
      y: cumulative,
      yaxis: 'y2',
      name: 'Cumulative ETr',
      line: { color: 'rgb(76, 99, 152)', width: 2 },
      hovertemplate:
        '<b>Date</b>: %{x|%b %d, %Y}<br><b>Cumulative ET</b>: %{y:.3f}<extra></extra>',
    } as Data,
  ]

  const yMax = Math.max(0, ...y.filter((v): v is number => v != null))
  const cumMax = cumulative[cumulative.length - 1] ?? 0

  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'h', y: -0.18 },
    yaxis: {
      title: { text: '<b>Reference ET (a=0.23) [in]</b>' },
      side: 'left',
      range: [0, yMax || 1],
    },
    yaxis2: {
      title: { text: '<b>Cumulative ETr [in]</b>' },
      side: 'right',
      overlaying: 'y',
      range: [0, cumMax || 1],
    },
    xaxis: { type: 'date', title: { text: '' } },
  }

  return { data: traces, layout }
}

/* -------------------------------------------------------------------------- */
/* Feels-Like chart — colored scatter (wind chill / heat index / avg temp)    */
/* -------------------------------------------------------------------------- */

function buildFeelsLikeFigure(data: ObservationRow[]) {
  const sorted = [...data].sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime)),
  )
  const x = datesOf(sorted)
  const y = numCol(sorted, 'Feels Like Temperature [°F]')

  type Bucket = 'Wind Chill' | 'Heat Index' | 'Average Temperature'
  const colors: Record<Bucket, string> = {
    'Wind Chill': 'blue',
    'Heat Index': 'red',
    'Average Temperature': 'green',
  }
  const bucket: Bucket[] = sorted.map((r) => {
    if (typeof r['Wind Chill [°F]'] === 'number') return 'Wind Chill'
    if (typeof r['Heat Index [°F]'] === 'number') return 'Heat Index'
    return 'Average Temperature'
  })

  const traces: Data[] = [
    {
      type: 'scatter',
      mode: 'lines',
      x,
      y,
      line: { color: '#000', width: 1 },
      name: 'Feels Like',
      showlegend: false,
      hoverinfo: 'skip',
    } as Data,
  ]

  for (const k of Object.keys(colors) as Bucket[]) {
    const ix = bucket.map((b, i) => (b === k ? i : -1)).filter((i) => i >= 0)
    if (ix.length === 0) continue
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: ix.map((i) => x[i]),
      y: ix.map((i) => y[i]),
      marker: { color: colors[k], size: 7 },
      name: k,
      hovertemplate: '<b>%{x|%b %d, %Y %H:%M}</b><br>%{y:.1f} °F<extra>' + k + '</extra>',
    } as Data)
  }

  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'h', y: -0.18 },
    yaxis: { title: { text: '<b>Feels Like Temperature [°F]</b>' } },
    xaxis: { type: 'date' },
  }
  return { data: traces, layout }
}

/* -------------------------------------------------------------------------- */
/* GDD chart — daily GDD bar + cumulative line w/ growth-stage marker colors. */
/* -------------------------------------------------------------------------- */

/**
 * "Method B" growing degree day:
 *   Tmin' = max(low, Tmin)   // floor
 *   Tmax' = min(high, Tmax)  // cap
 *   GDD   = max(0, (Tmin' + Tmax') / 2 - low)
 *
 * Used because the new RDS API ignores `low`/`high` query params and always
 * uses its per-crop default thresholds. To make the slider responsive, we
 * recompute from Tmax/Tmin (which the API does return when `keep=true`).
 */
function methodBGdd(tmin: number, tmax: number, low: number, high: number): number {
  const lo = Math.max(low, tmin)
  const hi = Math.min(high, tmax)
  return Math.max(0, (lo + hi) / 2 - low)
}

function buildGddFigure(
  data: ObservationRow[],
  low: number,
  high: number,
) {
  const sorted = [...data].sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime)),
  )
  const x = datesOf(sorted)
  const tmax = numCol(sorted, 'Maximum Air Temperature [°F]')
  const tmin = numCol(sorted, 'Minimum Air Temperature [°F]')

  // If the API returned Tmax/Tmin (keep=true), recompute from the slider
  // thresholds. Otherwise fall back to whatever the API computed itself.
  const haveTemps = tmax.some((v) => v != null) && tmin.some((v) => v != null)
  let daily: Array<number | null>
  let cumul: Array<number | null>
  if (haveTemps) {
    let running = 0
    daily = tmax.map((mx, i) => {
      const mn = tmin[i]
      if (mx == null || mn == null) return null
      return methodBGdd(mn, mx, low, high)
    })
    cumul = daily.map((d) => {
      if (d != null) running += d
      return running
    })
  } else {
    daily = numCol(sorted, 'GDDs [GDD °F]')
    let running = 0
    cumul = daily.map((d) => {
      if (d != null) running += d
      return running
    })
  }

  // Stage labels — the API surfaces both `Stage Name` (e.g. "Planted",
  // "Anthesis") and `Growth Stage` (numeric index). Prefer the readable one.
  const stage = sorted.map((r) => {
    const name = r['Stage Name']
    if (typeof name === 'string' && name.length > 0) return name
    const numeric = r['Growth Stage']
    if (numeric != null && numeric !== '') return `Stage ${String(numeric)}`
    return ''
  })

  const stageOrder = Array.from(new Set(stage)).filter((s) => s.length > 0)
  const stageColor = new Map<string, string>()
  stageOrder.forEach((s, i) => {
    stageColor.set(s, GDD_STAGE_COLORS[i % GDD_STAGE_COLORS.length])
  })
  const markerColors = stage.map((s) => stageColor.get(s) ?? '#888')

  const traces: Data[] = [
    {
      type: 'bar',
      x,
      y: daily,
      name: `Daily GDDs (${low}–${high} °F)`,
      marker: { color: '#DDCC77' /* Tol-Muted "sand" — CVD-safe */ },
      hovertemplate:
        '<b>Date</b>: %{x|%b %d, %Y}<br><b>Daily GDDs</b>: %{y:.1f}<extra></extra>',
    } as Data,
    {
      type: 'scatter',
      mode: 'lines+markers',
      x,
      y: cumul,
      yaxis: 'y2',
      name: 'Cumulative GDDs',
      line: { color: '#332288' /* Tol-Muted "indigo" */, width: 2 },
      marker: {
        color: stageOrder.length > 0 ? markerColors : '#332288',
        size: 7,
      },
      customdata: stage as unknown as number[],
      hovertemplate:
        '<b>Date</b>: %{x|%b %d, %Y}<br><b>Cumulative GDDs</b>: %{y:.0f}<br><b>Growth Stage</b>: %{customdata}<extra></extra>',
    } as Data,
  ]

  // Stage info shows up only in the hover popup (via `customdata`); we don't
  // want a legend entry per stage cluttering the chart.

  const dailyMax = Math.max(0, ...daily.filter((v): v is number => v != null))
  const cumMax = Math.max(0, ...cumul.filter((v): v is number => v != null))

  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'h', y: -0.2 },
    yaxis: {
      title: { text: '<b>Daily GDDs [GDD °F]</b>' },
      side: 'left',
      range: [0, dailyMax || 1],
    },
    yaxis2: {
      title: { text: '<b>Cumulative GDDs [GDD °F]</b>' },
      side: 'right',
      overlaying: 'y',
      range: [0, cumMax || 1],
    },
    xaxis: { type: 'date' },
  }
  return { data: traces, layout }
}

/* -------------------------------------------------------------------------- */
/* Livestock CCI chart                                                        */
/* -------------------------------------------------------------------------- */

function classifyCci(value: number, newborn: boolean): keyof typeof CCI_RISK_COLORS {
  if (value >= 113) return 'Extreme Danger'
  if (value >= 105) return 'Extreme'
  if (value >= 96) return 'Severe'
  if (value >= 87) return 'Moderate'
  if (value >= 77) return 'Mild'
  if (newborn) {
    if (value >= 42) return 'No Stress'
    if (value >= 32) return 'Mild'
    if (value >= 23) return 'Moderate'
    if (value >= 14) return 'Severe'
    if (value >= 5) return 'Extreme'
    return 'Extreme Danger'
  }
  if (value >= 33) return 'No Stress'
  if (value >= 14) return 'Mild'
  if (value >= -4) return 'Moderate'
  if (value >= -22) return 'Severe'
  if (value >= -40) return 'Extreme'
  return 'Extreme Danger'
}

function buildCciFigure(data: ObservationRow[], newborn: boolean) {
  const sorted = [...data].sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime)),
  )
  const x = datesOf(sorted)
  const y = numCol(sorted, 'Comprehensive Climate Index [°F]')
  const cls = y.map((v) => (v == null ? null : classifyCci(v, newborn)))

  const traces: Data[] = [
    {
      type: 'scatter',
      mode: 'lines',
      x,
      y,
      line: { color: '#000', width: 1 },
      name: 'Risk',
      showlegend: false,
      hoverinfo: 'skip',
    } as Data,
  ]

  for (const k of Object.keys(CCI_RISK_COLORS)) {
    const ix = cls
      .map((c, i) => (c === k ? i : -1))
      .filter((i) => i >= 0)
    if (ix.length === 0) continue
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: ix.map((i) => x[i]),
      y: ix.map((i) => y[i]),
      marker: { color: CCI_RISK_COLORS[k], size: 8, line: { color: '#222', width: 0.5 } },
      name: k,
      hovertemplate:
        '<b>%{x|%b %d, %Y}</b><br>%{y:.1f} °F<extra>' + k + '</extra>',
    } as Data)
  }

  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'h', y: -0.18 },
    yaxis: { title: { text: '<b>Livestock Risk Index [°F]</b>' } },
    xaxis: { type: 'date' },
  }
  return { data: traces, layout }
}

/* -------------------------------------------------------------------------- */
/* SWP chart — log-y line per depth, with field-capacity / wilting-point fills*/
/* -------------------------------------------------------------------------- */

// Soil water-potential thresholds (positive bar magnitudes; the chart uses
// log Y reversed so the smaller numbers — wetter — render at the top).
const SWP_FIELD_CAPACITY = 0.33
const SWP_WILTING_POINT = 15

function depthLabelFromCol(c: string): string {
  const m = c.match(/@\s*(-?\d+)\s*(cm|in)/)
  return m ? (m[2] === 'in' ? `${m[1]} in` : `${m[1]} cm`) : c
}

function depthInchesFromLabel(label: string): number {
  const m = label.match(/(-?\d+)/)
  return m ? Math.abs(parseInt(m[1], 10)) : 0
}

function buildSwpFigure(data: ObservationRow[]) {
  const sorted = [...data].sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime)),
  )
  const x = datesOf(sorted)
  // The API may emit either "@ 2 in [bar]" (after LAB_SWAP) or "@ -5 cm [bar]"
  // (raw). Pick whichever set is present.
  const sample = (sorted[0] ?? {}) as Record<string, unknown>
  const cols = Object.keys(sample)
    .filter((c) => c.includes('Soil Water Potential') && c.includes('[bar]'))
    .sort(
      (a, b) =>
        depthInchesFromLabel(depthLabelFromCol(a)) -
        depthInchesFromLabel(depthLabelFromCol(b)),
    )

  // Sample Viridis at one stop per depth so shallow→deep traces inherit the
  // sequential ordering visually, and the palette is CVD/grayscale safe.
  const depthColors = sampleSequential(PALETTE_VIRIDIS, cols.length || 1)

  const traces: Data[] = []
  // Plant-available water shading. Two stacked filled traces let the bands
  // span the full date range without depending on Plotly shapes (which don't
  // play well with log axes in some plotly.js versions).
  if (sorted.length > 0) {
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: x.map(() => SWP_FIELD_CAPACITY),
      line: { color: 'rgba(0,0,0,0)', width: 0 },
      fill: 'tozeroy',
      fillcolor: 'rgba(150,150,150,0.18)',
      name: 'Saturated → Field Capacity',
      hoverinfo: 'skip',
      showlegend: false,
    } as Data)
    // Region beyond the wilting point (>15 bar). Use a sentinel "huge" upper
    // bound so the area extends to whatever the data max is on the log axis.
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: x.map(() => 1000),
      line: { color: 'rgba(0,0,0,0)', width: 0 },
      name: 'Beyond Wilting Point',
      hoverinfo: 'skip',
      showlegend: false,
    } as Data)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: x.map(() => SWP_WILTING_POINT),
      line: { color: 'rgba(0,0,0,0)', width: 0 },
      fill: 'tonexty',
      fillcolor: 'rgba(150,150,150,0.18)',
      name: 'Beyond Wilting Point',
      hoverinfo: 'skip',
      showlegend: false,
    } as Data)
    // Dashed reference lines for FC and WP.
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: x.map(() => SWP_FIELD_CAPACITY),
      line: { color: '#444', width: 1, dash: 'dash' },
      name: `Field Capacity (${SWP_FIELD_CAPACITY} bar)`,
      hoverinfo: 'skip',
    } as Data)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: x.map(() => SWP_WILTING_POINT),
      line: { color: '#444', width: 1, dash: 'dash' },
      name: `Wilting Point (${SWP_WILTING_POINT} bar)`,
      hoverinfo: 'skip',
    } as Data)
  }

  cols.forEach((c, idx) => {
    const depthLabel = depthLabelFromCol(c)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: numCol(sorted, c),
      name: depthLabel,
      line: { color: depthColors[idx] ?? '#555', width: 2 },
      connectgaps: false,
      hovertemplate:
        '<b>%{x|%b %d, %Y}</b><br>%{y:.2f} bar<extra>' + depthLabel + '</extra>',
    } as Data)
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
    annotations: [
      {
        text: 'Saturated',
        x: 0.01,
        y: 0.985,
        xref: 'paper',
        yref: 'paper',
        showarrow: false,
        bgcolor: 'rgba(255,255,255,0.85)',
        bordercolor: '#444',
        borderwidth: 1,
        borderpad: 4,
        font: { size: 10 },
      },
      {
        text: 'Plant-Available Water',
        x: 0.01,
        y: 0.5,
        xref: 'paper',
        yref: 'paper',
        showarrow: false,
        bgcolor: 'rgba(255,255,255,0.6)',
        font: { size: 10 },
      },
      {
        text: 'Wilting / Unavailable',
        x: 0.01,
        y: 0.02,
        xref: 'paper',
        yref: 'paper',
        showarrow: false,
        bgcolor: 'rgba(255,255,255,0.85)',
        bordercolor: '#444',
        borderwidth: 1,
        borderpad: 4,
        font: { size: 10 },
      },
    ],
  }

  return { data: traces, layout }
}

/* -------------------------------------------------------------------------- */
/* Percent Saturation chart                                                   */
/* -------------------------------------------------------------------------- */

function buildPercentSatFigure(data: ObservationRow[]) {
  const sorted = [...data].sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime)),
  )
  const x = datesOf(sorted)
  const sample = (sorted[0] ?? {}) as Record<string, unknown>
  const cols = Object.keys(sample)
    .filter((c) => c.includes('Percent Saturation') && c.includes('[%]'))
    .sort(
      (a, b) =>
        depthInchesFromLabel(depthLabelFromCol(a)) -
        depthInchesFromLabel(depthLabelFromCol(b)),
    )

  // Depth-ordered Viridis sample so the palette matches SWP and conveys
  // shallow→deep ordering visually.
  const depthColors = sampleSequential(PALETTE_VIRIDIS, cols.length || 1)

  const traces: Data[] = []
  cols.forEach((c, idx) => {
    const depthLabel = depthLabelFromCol(c)
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x,
      y: numCol(sorted, c),
      name: depthLabel,
      line: { color: depthColors[idx] ?? '#555', width: 2 },
      connectgaps: false,
      hovertemplate:
        '<b>%{x|%b %d, %Y}</b><br>%{y:.1f} %<extra>' + depthLabel + '</extra>',
    } as Data)
  })

  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'h', y: -0.2 },
    yaxis: { title: { text: '<b>Percent Saturation [%]</b>' } },
    xaxis: { type: 'date' },
  }
  return { data: traces, layout }
}

/* -------------------------------------------------------------------------- */
/* Soil Profile heatmap                                                       */
/* -------------------------------------------------------------------------- */

function depthOrder(label: string): number {
  // Accept "-5 cm" or "5 in" — sort by depth (shallow → deep, ie. less negative or smaller positive on top).
  const m = label.match(/(-?\d+)/)
  return m ? Math.abs(parseInt(m[1], 10)) : 0
}

/**
 * Heatmap palettes — perceptually uniform and CVD-safe.
 *
 * - **PALETTE_HEATMAP_VIRIDIS** for sequential data (VWC, Bulk EC, % Sat, SWP):
 *   ordered, monotonic-luminance, distinguishable across all CVD types and
 *   in grayscale. Sampled from `matplotlib.cm.viridis`.
 * - **PALETTE_HEATMAP_DIVERGING** for soil temperature, where 32 °F (freezing)
 *   is a meaningful midpoint. Cividis-style cool→warm with a neutral middle.
 *   Both ends remain CVD-distinguishable; the dark midpoint avoids the
 *   "white in the middle" trap of RdBu (which collapses for dichromats).
 */
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
const PALETTE_HEATMAP_DIVERGING: Array<[number, string]> = [
  [0.0, '#3B4CC0'],
  [0.25, '#7AA1FF'],
  [0.5, '#DDDDDD'],
  [0.75, '#F49A7B'],
  [1.0, '#B40426'],
]

function buildSoilHeatmap(data: ObservationRow[], soilVar: string) {
  const sorted = [...data].sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime)),
  )
  if (sorted.length === 0)
    return { data: [] as Data[], layout: { ...baseLayout } }

  const sample = sorted[0] as Record<string, unknown>

  let prefix: string
  let zUnits: string
  let colorscale: Array<[number, string]>
  let midpoint: number | undefined
  let label: string
  let reverseScale = false
  if (soilVar === 'soil_vwc') {
    prefix = 'Soil VWC '
    zUnits = '%'
    label = 'Soil VWC [%]'
    colorscale = PALETTE_HEATMAP_VIRIDIS
  } else if (soilVar === 'soil_temp') {
    prefix = 'Soil Temperature '
    zUnits = '°F'
    label = 'Soil Temperature [°F]'
    colorscale = PALETTE_HEATMAP_DIVERGING
    midpoint = 32
  } else if (soilVar === 'swp') {
    prefix = 'Soil Water Potential '
    zUnits = 'bar'
    label = 'Soil Water Potential [bar]'
    colorscale = PALETTE_HEATMAP_VIRIDIS
    reverseScale = true // wetter (lower magnitude) reads as the bright end
  } else if (soilVar === 'percent_saturation') {
    prefix = 'Percent Saturation '
    zUnits = '%'
    label = 'Percent Saturation [%]'
    colorscale = PALETTE_HEATMAP_VIRIDIS
  } else {
    prefix = 'Bulk EC '
    zUnits = 'mS/cm'
    label = 'Soil Electrical Conductivity [mS/cm]'
    colorscale = PALETTE_HEATMAP_VIRIDIS
  }

  const cols = Object.keys(sample).filter(
    (c) => c.startsWith(prefix) && c.includes('@'),
  )
  if (cols.length === 0)
    return { data: [] as Data[], layout: { ...baseLayout } }

  // Each column has form `${prefix}@ <depth> [<units>]`; extract depth label.
  const colDepth = new Map<string, string>()
  for (const c of cols) {
    const m = c.match(/@\s*(-?\d+\s*(?:cm|in))/)
    if (m) colDepth.set(c, m[1].replace(/\s+/g, ' '))
  }

  // Sorted ascending by absolute depth (shallow first); reverse so y-axis
  // shows shallow on top, deep on bottom.
  const sortedCols = [...cols].sort(
    (a, b) => depthOrder(colDepth.get(a) ?? a) - depthOrder(colDepth.get(b) ?? b),
  )

  const x = datesOf(sorted)
  const y = sortedCols.map((c) => colDepth.get(c) ?? c)
  const rawZ: Array<Array<number | null>> = sortedCols.map((c) => numCol(sorted, c))

  // SWP varies over orders of magnitude (0.1 → 1000+ bar). Plot log10(z) so
  // drier soils don't wash out the wetter ones. Customdata carries the raw
  // value for the hover label.
  const isLog = soilVar === 'swp'
  const z: Array<Array<number | null>> = isLog
    ? rawZ.map((row) =>
        row.map((v) => (typeof v === 'number' && v > 0 ? Math.log10(v) : null)),
      )
    : rawZ

  // Find min/max for color midpoint.
  let mn = Infinity
  let mx = -Infinity
  for (const row of z) {
    for (const v of row) {
      if (typeof v === 'number') {
        if (v < mn) mn = v
        if (v > mx) mx = v
      }
    }
  }
  const mid = midpoint ?? (Number.isFinite(mn) && Number.isFinite(mx) ? (mn + mx) / 2 : 0)

  // For SWP, label colorbar ticks in raw bar units while the data is log10.
  // Cover the range from saturated (~0.1) through wilting (15) and drier.
  const swpTickVals = [-1, Math.log10(0.33), 0, 1, Math.log10(15), 2, 3]
  const swpTickText = ['0.1', 'FC (0.33)', '1', '10', 'WP (15)', '100', '1000']

  const traces: Data[] = [
    {
      type: 'heatmap',
      x,
      y,
      z,
      customdata: rawZ as unknown as number[][],
      colorscale,
      reversescale: reverseScale,
      zmid: mid,
      colorbar: isLog
        ? {
            title: { text: label, side: 'right' as const },
            tickvals: swpTickVals,
            ticktext: swpTickText,
          }
        : { title: { text: label, side: 'right' as const } },
      hovertemplate:
        '<b>%{x|%b %d, %Y}</b><br><b>Depth</b>: %{y}<br><b>Value</b>: ' +
        (isLog ? '%{customdata:.2f}' : '%{z:.2f}') +
        ' ' +
        zUnits +
        '<extra></extra>',
    } as Data,
  ]

  const layout: Partial<Layout> = {
    ...baseLayout,
    yaxis: {
      title: { text: '<b>Soil Depth</b>' },
      autorange: 'reversed',
      type: 'category',
    },
    xaxis: { type: 'date' },
  }
  return { data: traces, layout }
}

/* -------------------------------------------------------------------------- */
/* Annual Comparison line plot                                                */
/* -------------------------------------------------------------------------- */

/**
 * Sequential CVD-safe palette for year-over-year traces. Sampled from
 * Viridis so older years map to dark cool tones and recent years to
 * brighter ones; current year is overridden to black for emphasis.
 */
function yearPalette(n: number): string[] {
  return sampleSequential(PALETTE_VIRIDIS, Math.max(2, n))
}

function buildAnnualFigure(data: ObservationRow[], colName: string) {
  if (data.length === 0)
    return { data: [] as Data[], layout: { ...baseLayout } }

  const sorted = [...data].sort((a, b) =>
    String(a.datetime).localeCompare(String(b.datetime)),
  )

  // Group by year. Y is colName (or cumulative if precipitation).
  const isPpt = /Precipitation/i.test(colName)
  type Pt = { julian: number; value: number | null }
  const byYear = new Map<number, Pt[]>()

  for (const r of sorted) {
    const dt = new Date(String(r.datetime))
    if (isNaN(dt.getTime())) continue
    const year = dt.getUTCFullYear()
    const start = Date.UTC(year, 0, 0)
    const julian = Math.floor((dt.getTime() - start) / 86400000)
    const v = (r as Record<string, unknown>)[colName]
    const num = typeof v === 'number' ? v : null
    let list = byYear.get(year)
    if (!list) {
      list = []
      byYear.set(year, list)
    }
    list.push({ julian, value: num })
  }

  const years = [...byYear.keys()].sort((a, b) => a - b)
  const palette = yearPalette(years.length)
  const traces: Data[] = []
  const currentYear = new Date().getUTCFullYear()

  years.forEach((year, i) => {
    const list = byYear.get(year)!
    list.sort((a, b) => a.julian - b.julian)
    let yvals: Array<number | null>
    if (isPpt) {
      let cum = 0
      yvals = list.map((p) => {
        if (p.value != null) cum += p.value
        return cum
      })
    } else {
      yvals = list.map((p) => p.value)
    }
    const isCurrent = year === currentYear
    const color = isCurrent
      ? '#111111'
      : palette[Math.min(palette.length - 1, i)]
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: list.map((p) => p.julian),
      y: yvals,
      name: String(year),
      line: { color, width: isCurrent ? 3 : 1.4 },
      connectgaps: false,
      hovertemplate:
        '<b>Day of year</b>: %{x}<br>%{y:.2f}<extra>' + year + '</extra>',
    } as Data)
  })

  const yLabel = isPpt ? 'Annual Cumulative Precipitation [in]' : colName
  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'v', x: 1.01, xanchor: 'left', y: 1, yanchor: 'top' },
    margin: { l: 70, r: 110, t: 30, b: 50 },
    xaxis: { title: { text: 'Day of Year' }, range: [1, 366] },
    yaxis: { title: { text: yLabel } },
  }
  return { data: traces, layout }
}

/* -------------------------------------------------------------------------- */
/* Public dispatcher                                                          */
/* -------------------------------------------------------------------------- */

export interface DerivedChartProps {
  variable: string
  data: ObservationRow[] | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  /** For 'soil_temp,soil_ec_blk' — which sub-variable to colormap. */
  soilVar?: string
  /** For 'cci' — adult or newborn. */
  newborn?: boolean
  /** For annual comparison plots — column to plot. */
  annualColumn?: string
  /** For 'gdd' — base/cap thresholds from the slider; recomputed client-side. */
  gddLow?: number
  gddHigh?: number
}

export function DerivedChart(props: DerivedChartProps) {
  const figure = useMemo(() => {
    const data = props.data
    if (!data || data.length === 0) return null
    if (props.variable === 'etr') return buildEtrFigure(data)
    if (props.variable === 'feels_like') return buildFeelsLikeFigure(data)
    if (props.variable === 'gdd')
      return buildGddFigure(data, props.gddLow ?? 50, props.gddHigh ?? 86)
    if (props.variable === 'cci') return buildCciFigure(data, !!props.newborn)
    if (props.variable === 'swp') return buildSwpFigure(data)
    if (props.variable === 'percent_saturation') return buildPercentSatFigure(data)
    if (props.variable === 'soil_temp,soil_ec_blk')
      return buildSoilHeatmap(data, props.soilVar ?? 'soil_vwc')
    if (props.variable === 'annual')
      return buildAnnualFigure(data, props.annualColumn ?? '')
    return null
  }, [
    props.data,
    props.variable,
    props.soilVar,
    props.newborn,
    props.annualColumn,
    props.gddLow,
    props.gddHigh,
  ])

  if (props.isLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    )
  }
  if (props.isError) {
    return (
      <Center h="100%" px="md">
        <Text c="red" size="sm">
          {(props.error as Error)?.message ?? 'Failed to fetch derived data.'}
        </Text>
      </Center>
    )
  }
  if (!figure || figure.data.length === 0) {
    return (
      <Center h="100%">
        <Text c="dimmed" size="sm">
          No data for the current selection.
        </Text>
      </Center>
    )
  }

  return (
    <Plot
      data={figure.data}
      layout={figure.layout}
      config={PLOT_CONFIG}
      revision={(figure.data.length << 4) ^ props.variable.length}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
