/**
 * Paging for the variable page's Table view (the chart's table twin, made
 * visible). Newest rows first, so page 1 is the latest readings; a table in a
 * fixed order (the wind rose's compass points) keeps its order.
 */

export const PAGE_SIZE = 50

export interface TablePage {
  rows: string[][]
  /** 1-based page, clamped to [1, pages]. */
  page: number
  pages: number
  /** "Rows 1–50 of 336", or "No rows". */
  summary: string
}

/** Page `page` (1-based) of `rows` (oldest first, as the twin builds them), newest first unless `fixedOrder`. */
export function tablePage(rows: readonly string[][], page: number, size = PAGE_SIZE, fixedOrder = false): TablePage {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const p = Math.min(pages, Math.max(1, Math.floor(page) || 1))
  const ordered = fixedOrder ? [...rows] : [...rows].reverse()
  const from = (p - 1) * size
  const out = ordered.slice(from, from + size)
  return { rows: out, page: p, pages, summary: rows.length ? `Rows ${from + 1}–${from + out.length} of ${rows.length}` : 'No rows' }
}
