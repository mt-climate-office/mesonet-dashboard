/**
 * The stats card under an Ag tool's chart, where a summary means something:
 * Reference ET's total over the window, feels-like and livestock-risk lows and
 * highs, growing degree days so far and the stage reached. Soil and Annual
 * tools have none (many depths or years; the chart is the summary). Values
 * come from the chart's own model, so they always match what is drawn. Pure.
 */
import type { GddModel } from '../../charts/agGdd'
import { formatReading } from '../../variables/labels'
import { cToF, mmToIn } from '../compute/units'
import type { MetChart } from './results'

export interface AgStat {
  label: string
  value: string
}

const finite = (xs: readonly (number | null)[]) => xs.filter((v): v is number => v !== null && Number.isFinite(v))
const lowHigh = (xs: readonly (number | null)[], fmt: (v: number) => string): AgStat[] => {
  const v = finite(xs)
  return v.length
    ? [
        { label: 'Low', value: fmt(v.reduce((a, b) => (b < a ? b : a))) },
        { label: 'High', value: fmt(v.reduce((a, b) => (b > a ? b : a))) },
      ]
    : []
}

/** ETr: the window's total; feels like and livestock risk: low and high (°F). */
export function metStats(c: MetChart | null): AgStat[] {
  if (!c) return []
  if (c.kind === 'etr') {
    const inches = finite(c.model.series.etoMm.map((v) => mmToIn(v)))
    return inches.length ? [{ label: 'Total', value: formatReading('etr', inches.reduce((a, b) => a + b, 0)) }] : []
  }
  return lowHigh(c.model.series.valueC.map((v) => cToF(v)), (f) => formatReading('feels_like', f))
}

/** GDD: the accumulation at the last observed day, and the growth stage reached (crops with a stage table). */
export function gddStats(m: GddModel | null): AgStat[] {
  if (!m) return []
  const so = finite(m.series.cumulative).at(-1)
  const stage = m.stageMode === 'table' ? m.series.stageName.filter(Boolean).at(-1) : null
  return [
    ...(so === undefined ? [] : [{ label: 'So far', value: formatReading('gdd', so) }]),
    ...(stage ? [{ label: 'Stage', value: stage }] : []),
  ]
}
