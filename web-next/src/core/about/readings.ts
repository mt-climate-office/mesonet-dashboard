/**
 * About's "All current readings" sheet: the current-conditions rows
 * (core/cards/currentConditions) and the HydroMet precipitation summary with
 * plain labels (core/variables/labels) and units on the values. Each row keeps
 * its API column (`col`) for the fidelity harness, which matches web/'s labels.
 */
import { ELEM_MAP } from '../params/latest'
import { depthLabelFromColumn, variableForColumn } from '../params/columns'
import { currentConditionsRows, pptSummaryRows } from '../cards/currentConditions'
import { LABELS, formatReading } from '../variables/labels'

export interface Reading {
  /** The API column ("Soil VWC @ 4 in [%]"), or "Timestamp". */
  col: string
  /** Plain label: "Soil moisture at 4 in". */
  label: string
  /** Value with its unit: "13.4%", "57.0 °F", "ESE (111.6 deg)". */
  value: string
}

/** The LABELS id for a (LAB_SWAP-normalised) column, or null. */
function labelId(col: string): string | null {
  if (col.startsWith('Feels like')) return 'feels_like'
  const v = variableForColumn(col)
  return v ? (ELEM_MAP[v]?.[0] ?? null) : null
}

/**
 * Plain label for an API column: "Air Temperature [°F]" → "Air temperature",
 * "Bulk EC @ 4 in [mS/cm]" → "Soil salinity (EC) at 4 in", "Timestamp" →
 * "Observed". A column LABELS does not know keeps its API name before "[".
 */
export function readingLabel(col: string): string {
  if (col === 'Timestamp') return 'Observed'
  const id = labelId(col)
  const name = id ? LABELS[id].name : col.split('[')[0].trim()
  const depth = id ? depthLabelFromColumn(col) : null
  return depth ? `${name} at ${depth}` : name
}

/**
 * A value as the table shows it: a leading number at the variable's table
 * precision with its unit ("56.984" → "57.0 °F"; "41.23 (wind chill)" →
 * "41.2 °F (wind chill)"); other text (timestamps, "ESE (111.6 deg)") as is.
 * Unknown columns keep the number and take the unit from the column's brackets.
 */
export function readingValue(col: string, value: string): string {
  const m = /^(-?\d+(?:\.\d+)?)(.*)$/.exec(value)
  if (!m || col === 'Timestamp') return value
  const id = labelId(col)
  if (id) return formatReading(id, Number(m[1]), 'table') + m[2]
  const unit = /\[([^\]]+)\]/.exec(col)?.[1]
  return unit ? `${m[1]} ${unit}${m[2]}` : value
}

/** Every current reading, Observed first (order as core/cards `currentConditionsRows`). */
export function readingRows(latest: Record<string, unknown>): Reading[] {
  return currentConditionsRows(latest).map(([col, v]) => ({ col, label: readingLabel(col), value: readingValue(col, v) }))
}

/**
 * Plain period for a `/derived/ppt/` column: "Year to Date Precipitation [in]"
 * → "Year to date", "180-day Precipitation [in]" → "Last 180 days",
 * "24-hour Precipitation [in]" → "Last 24 hours", "Precipitation Since
 * Midnight [in]" → "Since midnight".
 */
export function pptLabel(col: string): string {
  const s = col.replace(/\[[^\]]*\]/, '').replace(/precipitation/i, '').replace(/\s+/g, ' ').trim()
  const n = /^(\d+)-(day|hour)$/.exec(s)
  if (n) return `Last ${n[1]} ${n[2]}s`
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/** The HydroMet precipitation summary (core/cards `pptSummaryRows`, newest window first). */
export function pptRows(summary: Record<string, unknown> | undefined): Reading[] {
  return pptSummaryRows(summary).map(([col, value]) => ({ col, label: pptLabel(col), value }))
}
