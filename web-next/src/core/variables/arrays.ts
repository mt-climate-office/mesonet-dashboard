/**
 * The soil pages' Arrays row (`arrays=1`): each depth as one combined series, or one line
 * per sensor array (the API's `split_arrays`; core/models/timeseries `splitArrays`, array B
 * dashed in core/charts/latestTimeseries). Pure.
 */
import { isDepthVariable, type TimeseriesPanel } from '../models/timeseries'
import type { UrlState } from '../url-schema'
import type { Variable } from './catalog'

/** The row's chips, in order: combined (the key absent), then each array. */
export const ARRAY_CHIPS = [
  { id: 'combined', label: 'Combined' },
  { id: 'split', label: 'Separate' },
] as const
export type ArrayChip = (typeof ARRAY_CHIPS)[number]['id']

/** Why Separate draws no array lines: every depth had one sensor over the window. */
export const ONE_ARRAY_NOTE = 'This station had one sensor at each depth over these dates.'

/** The page for `v` offers the row: a variable drawn one line per soil depth. */
export const offersArrays = (v: Pick<Variable, 'name'> | undefined): boolean => !!v && isDepthVariable(v.name)

/** The page draws each array: `arrays=1` on a soil page. */
export const splitsArrays = (state: Pick<UrlState, 'arrays'>, v: Pick<Variable, 'name'> | undefined): boolean => offersArrays(v) && state.arrays

/** URL patch for a chip: Separate sets the key, Combined clears it. */
export const arraysPatch = (id: ArrayChip): Partial<UrlState> => ({ arrays: id === 'split' })

/** The note under the row: ONE_ARRAY_NOTE when Separate drew a panel with no array series, else ''. */
export const arraysNote = (split: boolean, panel: TimeseriesPanel | undefined): string =>
  split && panel && !panel.noData && !panel.series.some((s) => s.probe) ? ONE_ARRAY_NOTE : ''
