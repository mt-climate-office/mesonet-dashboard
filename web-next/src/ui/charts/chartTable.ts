/**
 * `x-data="chartTable({ table: () => … })"`: a chart's table twin made
 * visible, in place of the chart (⋯ → Show as table, `tbl=1`), newest rows
 * first, 50 per page (core/variables `tablePage`). Any chart page uses it
 * with its builder's `…Table(model)`; markup in partials/charts/table.html.
 */
import type { ChartTable } from '../../core/charts'
import { tablePage, type TablePage } from '../../core/variables'
import { component } from '../component'

export function chartTable(o: { table: () => ChartTable | null }) {
  return component({
    page: 1,
    init() {
      // A new table (variable, window, interval) starts on its first page.
      this.$watch('key', () => (this.page = 1))
    },
    get table(): ChartTable | null {
      return o.table()
    },
    get key(): string {
      const t = this.table
      return t ? `${t.caption}|${t.columns.join(',')}|${t.rows.length}` : ''
    },
    get view(): TablePage {
      return tablePage(this.table?.rows ?? [], this.page)
    },
  })
}
