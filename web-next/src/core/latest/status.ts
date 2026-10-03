/**
 * What the Latest plot area shows: the chart, a loading note, the error
 * state (a request failed: partials/load-error.html) or a legacy empty-state message. ui/charts (Compare, variable page) feed it the current inputs;
 * `dataSettled` gates what describes the data (announcements, stats).
 */
import { noData, type TimeseriesEmpty } from '../models/timeseries'

export type PlotStatus = { kind: 'ready' } | { kind: 'loading' } | { kind: 'error' } | { kind: 'empty'; title: string; hint?: string }

export interface PlotStatusInput {
  /** `emptyState(...)` result. */
  empty: TimeseriesEmpty | null
  /** Inputs for a request are still loading (catalog or element list). */
  waiting: boolean
  /** The record resource's status, or null when there is no request to make. */
  record: 'loading' | 'success' | 'error' | null
  /** A model is drawable (possibly the previous window's, kept while loading). */
  hasModel: boolean
  /** A request the plot depends on (the element list) failed. */
  failed?: boolean
}

const message = (e: TimeseriesEmpty): PlotStatus => ({ kind: 'empty', title: e.title, hint: 'hint' in e ? e.hint : undefined })

/**
 * Empty states first (legacy order); then the error state when the element
 * list or the record failed (never "no data", which would blame the station);
 * then loading (keeping a drawable plot); then the no-data message for no rows
 * or no request to make, which would otherwise never stop "loading".
 */
export function plotStatus(i: PlotStatusInput): PlotStatus {
  if (i.empty) return message(i.empty)
  if (i.failed || i.record === 'error') return { kind: 'error' }
  if ((i.record === null && i.waiting) || i.record === 'loading') return i.hasModel ? { kind: 'ready' } : { kind: 'loading' }
  if (i.record === null || !i.hasModel) return message(noData())
  return { kind: 'ready' }
}

/**
 * The drawn model belongs to the current request: it has loaded and nothing is
 * in flight. While a new window loads, the plot keeps the previous model, so
 * the live-region announcement and the stats wait for this.
 */
export function dataSettled(i: Pick<PlotStatusInput, 'record' | 'hasModel'>): boolean {
  return i.record === 'success' && i.hasModel
}
