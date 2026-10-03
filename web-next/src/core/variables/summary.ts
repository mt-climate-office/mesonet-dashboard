/**
 * The variable list's rows: each variable's current value and a 48 h
 * sparkline. Values come from the `/latest` row (the Now section's request);
 * sparklines and the 24 h totals of summed variables from one 72 h hourly
 * request for every listed variable (`listRequest`). Columns are LAB_SWAP-renamed
 * (core/csv); a multi-depth variable shows its shallowest column.
 */
import dayjs from 'dayjs'
import type { ObservationRow } from '../api'
import { sparkline, type Sparkline } from '../charts/sparkline'
import { recordRequest, type RecordRequest } from '../latest/requests'
import { depthLabelFromColumn, latestVariableForColumn } from '../params'
import { parseWallClock } from '../sensorEvents'
import type { Variable } from './catalog'
import { fmtStat } from './stats'

type ElementRow = { element: string; description_short: string }

const HOUR = 3_600_000

export interface VariableRow {
  id: string
  name: string
  /** "57 °F", or "—" without a reading. */
  value: string
  /** What the value is: "at 2 in", "last 24 h", or ''. */
  note: string
  spark: Sparkline | null
  /** Screen-reader sentence for the sparkline; '' without one. */
  sparkLabel: string
}

/** The column that stands for `name`: its only column, or the shallowest depth; null if none. */
export function primaryColumn(cols: readonly string[], name: string): string | null {
  const mine = cols.filter((c) => latestVariableForColumn(c) === name)
  const depth = (c: string) => Number.parseInt(depthLabelFromColumn(c) ?? '0', 10)
  return [...mine].sort((a, b) => depth(a) - depth(b))[0] ?? null
}

/** The list's one hourly request: local midnight two days before today through today, every listed variable. */
export function listRequest(station: string, vars: readonly Variable[], elements: readonly ElementRow[], today = dayjs()): RecordRequest | null {
  const window = { start: today.subtract(2, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD'), valid: true }
  return recordRequest({ station, window, agg: 'hourly', vars: vars.map((v) => v.name), stationElements: elements })
}

const unitOf = (col: string) => /\[([^\]]+)\]\s*$/.exec(col)?.[1] ?? ''
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Rows for `vars` from the `/latest` row and the hourly rows (either may still be loading). */
export function variableRows(vars: readonly Variable[], latest: Record<string, unknown> | undefined, hourly: readonly ObservationRow[] | undefined): VariableRow[] {
  const timed = (hourly ?? [])
    .map((r) => ({ t: parseWallClock(r.datetime), r: r as Record<string, unknown> }))
    .filter((x): x is { t: number; r: Record<string, unknown> } => x.t !== null)
    .sort((a, b) => a.t - b.t)
  const end = timed.length ? timed[timed.length - 1].t : 0
  const last48 = timed.filter((x) => x.t > end - 48 * HOUR)
  const hourlyCols = timed.length ? Object.keys(timed[0].r) : []

  return vars.map((v) => {
    const col = primaryColumn(hourlyCols, v.name)
    const series = col ? { t: last48.map((x) => x.t), v: last48.map((x) => num(x.r[col])) } : null
    const spark = series ? sparkline(series, { kind: v.sum ? 'bars' : 'line' }) : null
    const vals = series ? series.v.filter((x): x is number => x !== null) : []
    const unit = col ? unitOf(col) : ''
    const fmt = (x: number, u: string) => `${fmtStat(x)}${u ? ` ${u}` : ''}`
    const sparkLabel = !spark
      ? ''
      : v.sum
        ? `Last 48 hours: ${fmt(vals.reduce((a, b) => a + b, 0), unit)} in total.`
        : `Last 48 hours: from ${fmt(vals.reduce((a, b) => Math.min(a, b)), unit)} to ${fmt(vals.reduce((a, b) => Math.max(a, b)), unit)}.`

    if (v.sum) {
      const day = col ? timed.filter((x) => x.t > end - 24 * HOUR).map((x) => num(x.r[col])).filter((x): x is number => x !== null) : []
      return { id: v.id, name: v.name, value: day.length ? fmt(day.reduce((a, b) => a + b, 0), unit) : '—', note: day.length ? 'last 24 h' : '', spark, sparkLabel }
    }
    // The current reading: /latest first (fresher), else the newest hourly value.
    const latestCol = latest ? primaryColumn(Object.keys(latest), v.name) : null
    const now = latestCol ? num(latest?.[latestCol]) : null
    const newest = col ? [...timed].reverse().map((x) => num(x.r[col])).find((x) => x !== null) ?? null : null
    const value = now ?? newest
    const valueCol = now !== null ? latestCol : col
    const depth = valueCol ? depthLabelFromColumn(valueCol) : null
    return { id: v.id, name: v.name, value: value === null ? '—' : fmt(value, unitOf(valueCol ?? '')), note: depth ? `at ${depth}` : '', spark, sparkLabel }
  })
}
