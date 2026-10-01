/**
 * Reference ET, feels-like and livestock-risk (CCI) figures. Layout, colors
 * and hover text follow the pre-Wave-3 DerivedChart (itself a port of
 * `app/mdb/utils/plot_derived.py`); axis titles are the legacy ones.
 */
import type { Data, Layout } from 'plotly.js'
import { CCI_RISK_COLORS } from '../../../lib/params/palettes'
import type { CciClass, CciSeries, EtoSeries, FeelsLikeRegime, FeelsLikeSeries } from '../contract'
import { cToF, cumulativeSum, mmToIn } from '../compute'
import {
  type Figure,
  type Period,
  baseLayout,
  finiteMax,
  hoverDate,
  insertGapsColumnar,
  xValues,
} from './common'

/* ------------------------------------------------------------------ ETr */

/** Daily/hourly reference ET bars (in) + cumulative line on y2. */
export function etoFigure(series: EtoSeries, period: Period): Figure {
  const x = xValues(series.time)
  const y = series.etoMm.map((v) => mmToIn(v))
  const cumulative = cumulativeSum(y)
  const line = insertGapsColumnar(series.epochMs, x, [cumulative])
  const traces: Data[] = [
    {
      type: 'bar',
      x,
      y,
      marker: { color: 'red' },
      name: 'ETr',
      hovertemplate: `<b>Date</b>: ${hoverDate(period)}<br><b>Reference ET Total</b>: %{y:.3f} in<extra></extra>`,
    } as Data,
    {
      type: 'scatter',
      mode: 'lines',
      x: line.x,
      y: line.ys[0],
      yaxis: 'y2',
      name: 'Cumulative ETr',
      connectgaps: false,
      line: { color: 'rgb(76, 99, 152)', width: 2 },
      hovertemplate: `<b>Date</b>: ${hoverDate(period)}<br><b>Cumulative Reference ET</b>: %{y:.3f} in<extra></extra>`,
    } as Data,
  ]
  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'h', y: -0.18 },
    yaxis: {
      title: { text: '<b>Reference ET<br>(a=0.23) [in]</b>' },
      side: 'left',
      range: [0, finiteMax(y) || 1],
    },
    yaxis2: {
      title: { text: '<b>Cumulative Reference ET<br>(a=0.23) [in]</b>' },
      side: 'right',
      overlaying: 'y',
      range: [0, finiteMax(cumulative) || 1],
    },
    xaxis: { type: 'date', title: { text: '' } },
  }
  return { data: traces, layout }
}

/* ----------------------------------------------------------- Feels like */

export const FEELS_LIKE_LABELS: Record<FeelsLikeRegime, string> = {
  wind_chill: 'Wind Chill',
  heat_index: 'Heat Index',
  air_temp: 'Average Temperature',
}

const FEELS_LIKE_COLORS: Record<FeelsLikeRegime, string> = {
  wind_chill: 'blue',
  heat_index: 'red',
  air_temp: 'green',
}

/** Black line + markers colored by which index produced the value. */
export function feelsLikeFigure(series: FeelsLikeSeries, period: Period): Figure {
  const x = xValues(series.time)
  const y = series.valueC.map((v) => cToF(v))
  const line = insertGapsColumnar(series.epochMs, x, [y])
  const traces: Data[] = [
    {
      type: 'scatter',
      mode: 'lines',
      x: line.x,
      y: line.ys[0],
      connectgaps: false,
      line: { color: '#000', width: 1 },
      name: 'Feels Like',
      showlegend: false,
      hoverinfo: 'skip',
    } as Data,
  ]
  for (const regime of Object.keys(FEELS_LIKE_LABELS) as FeelsLikeRegime[]) {
    const ix = series.regime.flatMap((r, i) => (r === regime && y[i] != null ? [i] : []))
    if (ix.length === 0) continue
    const label = FEELS_LIKE_LABELS[regime]
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: ix.map((i) => x[i]),
      y: ix.map((i) => y[i]),
      marker: { color: FEELS_LIKE_COLORS[regime], size: period === 'hourly' ? 4 : 7 },
      name: label,
      hovertemplate: `<b>${hoverDate(period)}</b><br>%{y:.1f} °F<extra>${label}</extra>`,
    } as Data)
  }
  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: { orientation: 'h', y: -0.18, title: { text: 'Index Used' } },
    yaxis: { title: { text: '<b>Feels Like Temperature<br>[°F]</b>' } },
    xaxis: { type: 'date' },
  }
  return { data: traces, layout }
}

/* ------------------------------------------------------------------ CCI */

/** Risk classes in severity order (legend order). */
export const CCI_CLASSES: CciClass[] = [
  'No Stress',
  'Mild',
  'Moderate',
  'Severe',
  'Extreme',
  'Extreme Danger',
]

/** Black line + markers colored by the adult/newborn risk class. */
export function cciFigure(series: CciSeries, period: Period): Figure {
  const x = xValues(series.time)
  const y = series.valueC.map((v) => cToF(v))
  const line = insertGapsColumnar(series.epochMs, x, [y])
  const traces: Data[] = [
    {
      type: 'scatter',
      mode: 'lines',
      x: line.x,
      y: line.ys[0],
      connectgaps: false,
      line: { color: '#000', width: 1 },
      name: 'Risk',
      showlegend: false,
      hoverinfo: 'skip',
    } as Data,
  ]
  for (const k of CCI_CLASSES) {
    const ix = series.class.flatMap((c, i) => (c === k && y[i] != null ? [i] : []))
    if (ix.length === 0) continue
    traces.push({
      type: 'scatter',
      mode: 'markers',
      x: ix.map((i) => x[i]),
      y: ix.map((i) => y[i]),
      marker: {
        color: CCI_RISK_COLORS[k],
        size: period === 'hourly' ? 5 : 8,
        line: { color: '#222', width: 0.5 },
      },
      name: k,
      hovertemplate: `<b>${hoverDate(period)}</b><br>%{y:.1f} °F<extra>${k}</extra>`,
    } as Data)
  }
  const layout: Partial<Layout> = {
    ...baseLayout,
    showlegend: true,
    legend: {
      orientation: 'h',
      y: -0.18,
      title: { text: series.livestock === 'newborn' ? 'Livestock Risk (newborn)' : 'Livestock Risk (adult)' },
    },
    yaxis: { title: { text: '<b>Livestock Risk Index [°F]</b>' } },
    xaxis: { type: 'date', title: { text: '' } },
  }
  return { data: traces, layout }
}
