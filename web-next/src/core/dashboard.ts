/**
 * The big-screen dashboard: with room for it, Now, About and the Charts list collapse into one
 * full-screen view of the station (charts of every variable, conditions, camera, details, map,
 * readings); chart pages stay their own pages. When it shows, which page a URL renders, how its
 * chart grid fits the space, and its range chips. Pure; stores/view.ts and ui/dashboard use it.
 */
import type { LatestTimeseriesModel } from './charts/latestTimeseries'
import type { Section } from './router'
import type { UrlState } from './url-schema'
import { chartsMode } from './variables/catalog'
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

export interface GridFit {
  cols: number
  rows: number
  /** Row height (px) when the rows fill the height, or null when they cannot and the grid scrolls at `minRow`. */
  rowHeight: number | null
}

/** A chart cell's floor (px): below these its axes and labels stop being readable. */
export const CELL_MIN = { width: 260, height: 150 } as const
/** The cell shape the grid aims for (width : height), a typical small time series. */
const TARGET_RATIO = 1.7

/**
 * Columns and rows for `n` charts in a `width` × `height` box with `gap` px between cells: of the
 * column counts whose cells fit CELL_MIN, the one whose cell shape is nearest TARGET_RATIO (fewer
 * empty cells on a tie). When no count lets every row fit, the most columns that stay CELL_MIN wide,
 * rows at CELL_MIN height, scrolling inside the grid.
 */
export function dashboardGrid(n: number, width: number, height: number, gap = 12): GridFit {
  if (n <= 0 || width <= 0 || height <= 0) return { cols: 1, rows: Math.max(n, 0), rowHeight: null }
  const maxCols = Math.max(1, Math.min(n, Math.floor((width + gap) / (CELL_MIN.width + gap))))
  let best: { fit: GridFit; score: number } | null = null
  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(n / cols)
    const w = (width - (cols - 1) * gap) / cols
    const h = (height - (rows - 1) * gap) / rows
    if (h < CELL_MIN.height) continue
    const score = Math.abs(Math.log(w / h / TARGET_RATIO)) + 0.02 * (rows * cols - n)
    if (!best || score < best.score) best = { fit: { cols, rows, rowHeight: Math.floor(h) }, score }
  }
  return best?.fit ?? { cols: maxCols, rows: Math.ceil(n / maxCols), rowHeight: null }
}

/** One variable's chart from the dashboard's model (one panel per variable, by display name); null without its panel. */
export function panelOf(m: LatestTimeseriesModel | null, name: string): LatestTimeseriesModel | null {
  const p = m?.ts.panels.find((x) => x.variable === name)
  return m && p ? { ...m, ts: { ...m.ts, panels: [p] } } : null
}
