/**
 * Downloader preview chart as a renderer-free model: one stacked panel per
 * exported numeric column (legacy `make_single_plot`), x in Denver
 * wall-clock ms (the chart breaks lines at gaps, core/charts/style). Extracted from
 * web/src/components/charts/DownloaderPreviewChart.tsx.
 */
import { DAYS_WITH_DATA_COLUMN } from '../aggregate'
import { META_COLUMNS, MISSING_DATA_COLUMN } from '../csv'
import { parseWallClock } from '../sensorEvents'
import type { DlPeriod } from '../url-schema'

type Row = Record<string, unknown>

/** Bookkeeping columns that are exported but not plotted. */
export const PREVIEW_SKIP_COLUMNS: ReadonlySet<string> = new Set([
  ...META_COLUMNS,
  MISSING_DATA_COLUMN,
  DAYS_WITH_DATA_COLUMN,
])

/** Legacy panel height, px (the chart grows; it does not squash panels). */
export const PREVIEW_PANEL_PX = 200

/** Hover date format per period (dayjs tokens). */
export const PREVIEW_HOVER_FORMAT: Record<DlPeriod, string> = {
  monthly: 'MMM YYYY',
  daily: 'MMM DD, YYYY',
  hourly: 'MMM DD, YYYY HH:mm',
}

export interface PreviewPanel {
  /** Exported column name; also the y-axis title. */
  column: string
  /** Aligned with `PreviewModel.x`; null = gap or missing. */
  values: (number | null)[]
}

export interface PreviewModel {
  period: DlPeriod
  /** Wall-clock ms per row. */
  x: number[]
  panels: PreviewPanel[]
  /** Monthly with ≤ 36 rows: one tick per month (legacy dtick M1). */
  monthlyTicks: boolean
}

/** Panels for `rows` (as exported, after any monthly aggregation); null when nothing numeric. */
export function buildPreviewModel(rows: readonly Row[], period: DlPeriod): PreviewModel | null {
  if (rows.length === 0) return null
  const colSet = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) if (!PREVIEW_SKIP_COLUMNS.has(k)) colSet.add(k)
  const cols = [...colSet].filter((c) => rows.some((r) => typeof r[c] === 'number'))
  if (cols.length === 0) return null
  return {
    period,
    x: rows.map((r) => parseWallClock(r.datetime) ?? NaN),
    panels: cols.map((column) => ({
      column,
      values: rows.map((r) => (typeof r[column] === 'number' ? (r[column] as number) : null)),
    })),
    monthlyTicks: period === 'monthly' && rows.length <= 36,
  }
}
