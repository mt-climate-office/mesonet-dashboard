/**
 * What the Latest plot area shows: the chart, a loading note, or a legacy
 * empty-state message. ui/charts (Compare, variable page) feed it the current inputs.
 */
import { noData, type TimeseriesEmpty } from '../models/timeseries'

export type PlotStatus = { kind: 'ready' } | { kind: 'loading' } | { kind: 'empty'; title: string; hint?: string }

export interface PlotStatusInput {
  /** `emptyState(...)` result. */
  empty: TimeseriesEmpty | null
  /** Inputs for a request are still loading (catalog or element list). */
  waiting: boolean
  /** The record resource's status, or null when there is no request to make. */
  record: 'loading' | 'success' | 'error' | null
  /** A model is drawable (possibly the previous window's, kept while loading). */
  hasModel: boolean
}

const message = (e: TimeseriesEmpty): PlotStatus => ({ kind: 'empty', title: e.title, hint: 'hint' in e ? e.hint : undefined })

/**
 * Empty states first (legacy order); then loading (keeping a drawable plot);
 * then the no-data message for an error, no rows, or no request to make,
 * which would otherwise never stop "loading".
 */
export function plotStatus(i: PlotStatusInput): PlotStatus {
  if (i.empty) return message(i.empty)
  if ((i.record === null && i.waiting) || i.record === 'loading') return i.hasModel ? { kind: 'ready' } : { kind: 'loading' }
  if (i.record === null || i.record === 'error' || !i.hasModel) return message(noData())
  return { kind: 'ready' }
}
