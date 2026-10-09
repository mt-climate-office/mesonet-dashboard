/**
 * The big-screen dashboard: with room for it, Now, About and the Charts list collapse into one
 * full-screen view of the station (every variable charted, conditions, camera, details, map,
 * readings); chart pages stay their own pages. When it shows, which page a URL renders, its range
 * chips, and how its variables split into two stacks. Pure; stores/view.ts and ui/dashboard use it.
 */
import type { LatestTimeseriesModel } from './charts/latestTimeseries'
import type { Section } from './router'
import type { UrlState } from './url-schema'
import { chartsMode, type Variable } from './variables/catalog'
import { RANGE_CHIPS, type RangePreset } from './variables/range'

/** The space the dashboard needs: the content column's width (beside the station drawer) and the window's height, CSS px. */
export const DASHBOARD_MIN_WIDTH = 1760
export const DASHBOARD_MIN_HEIGHT = 1000
export const showsDashboard = (width: number, height: number): boolean => width >= DASHBOARD_MIN_WIDTH && height >= DASHBOARD_MIN_HEIGHT

/** What the section host renders: the dashboard, or a section's own page. */
export type Page = 'dashboard' | Section

/**
 * The page for a URL: with room (`wide`), Now, About and the Charts list are the dashboard; a chart
 * (a variable, an Ag tool, Compare) keeps its own page. Without room, the section itself.
 */
export function pageFor(section: Section, state: Pick<UrlState, 'cmp' | 'v'>, wide: boolean): Page {
  if (!wide) return section
  return section === 'charts' && chartsMode(state) !== 'list' ? 'charts' : 'dashboard'
}

/** The dashboard's range chips: the chart pages' presets up to 30 days (one request holds every variable). */
export const DASHBOARD_RANGES: readonly { id: RangePreset['id']; label: string }[] = RANGE_CHIPS.flatMap((c) =>
  c.id === 'all' || c.id === '1y' ? [] : [{ id: c.id, label: c.label }],
)

/** The variable the dashboard draws as a wind rose of the window, not a time series. */
export const ROSE_ON_DASHBOARD = 'wind_dir'

/**
 * The time series in two stacks (columns of panels on a shared time axis), list order: split at the
 * group boundary nearest the middle (Weather | Rain, Soil, …), or at the middle when one group holds
 * them all. Wind direction is left out (it is the rose).
 */
export function stackColumns(vars: readonly Variable[]): [Variable[], Variable[]] {
  const list = vars.filter((v) => v.id !== ROSE_ON_DASHBOARD)
  if (list.length < 2) return [list, []]
  const half = list.length / 2
  let cut = Math.ceil(half)
  let best = Infinity
  for (let i = 1; i < list.length; i++) {
    if (list[i].group === list[i - 1].group) continue
    const d = Math.abs(i - half)
    if (d < best) [best, cut] = [d, i]
  }
  // A boundary far from the middle (one big group) would leave a stack nearly empty: split evenly instead.
  if (best > list.length / 4) cut = Math.ceil(half)
  return [list.slice(0, cut), list.slice(cut)]
}

/** A stack's model: the dashboard model's panels for `names`, in that order; null when none are there. */
export function stackOf(m: LatestTimeseriesModel | null, names: readonly string[]): LatestTimeseriesModel | null {
  if (!m) return null
  const panels = names.flatMap((n) => m.ts.panels.filter((p) => p.variable === n))
  return panels.length ? { ...m, ts: { ...m.ts, panels } } : null
}
