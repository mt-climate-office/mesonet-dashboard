/**
 * The one ECharts host. `ChartHost` owns everything stateful about a chart:
 * lazy ECharts load, init, kit theme (re-read on `mco-theme-change`), resize,
 * reduced motion, debounced zoom events, the `.sr-only` table twin, dispose.
 * Components use the `chart` Alpine wrapper (usage: core/charts/README.md).
 */
import Alpine from 'alpinejs'
import type { ECharts, EChartsOption } from 'echarts'
import { echartsTheme, readChartTheme } from '../../core/charts/theme'
import type { ChartBuilder, ChartContext, ChartTable, ChartTheme } from '../../core/charts/types'
import { THEME_EVENT, isTheme } from '../../core/theme'
import { component } from '../component'

export interface ChartOptions<M> {
  /** Pure builder from core/charts. */
  builder: ChartBuilder<M>
  /** Its `…Table` twin; rendered as an `.sr-only` table after every render. */
  table?: (model: M) => ChartTable
  /** Accessible name of the chart (canvas `aria-label`). */
  label: string
  /** Called with the visible x range (wall-clock ms) 250 ms after the user stops zooming. */
  onZoom?: (fromMs: number, toMs: number) => void
}

export interface ChartBindings<M> extends ChartOptions<M> {
  /** Model getter; null/undefined clears the chart. Read inside an Alpine effect, so it re-renders when its inputs change. */
  model: () => M | null | undefined
  /** Optional x range (wall-clock ms) to apply after each render, e.g. from the URL. */
  range?: () => [number, number] | null | undefined
}

const ZOOM_DEBOUNCE_MS = 250

let lib: Promise<typeof import('./echarts')> | null = null
const loadECharts = () => (lib ??= import('./echarts'))

const root = () => document.documentElement
const currentTheme = (): ChartTheme['name'] => {
  const t = typeof MCO !== 'undefined' ? MCO.getTheme() : root().dataset.theme
  return isTheme(t) ? t : 'dark'
}
const reducedMotion = () =>
  typeof MCO !== 'undefined' ? MCO.reducedMotion() : matchMedia('(prefers-reduced-motion: reduce)').matches
const isCompact = () => (typeof MCO !== 'undefined' ? MCO.viewport.isCompact() : matchMedia('(max-width: 640px)').matches)

/** One chart in `el`: a canvas div plus the sr-only table twin. */
export class ChartHost<M> {
  private canvas: HTMLDivElement
  private tableEl: HTMLTableElement
  private chart: ECharts | null = null
  private model: M | null = null
  private theme: ChartTheme
  private width = 0
  private zoomTimer = 0
  private disposed = false
  private silentZoom = false
  private ro: ResizeObserver
  private opts: ChartOptions<M>

  constructor(el: HTMLElement, opts: ChartOptions<M>) {
    this.opts = opts
    this.theme = this.readTheme(currentTheme())
    this.canvas = document.createElement('div')
    this.canvas.className = 'chart-canvas'
    this.canvas.setAttribute('role', 'img')
    this.canvas.setAttribute('aria-label', opts.label)
    // The wrapper carries .sr-only: a <table> ignores height: 1px and would still add its full height to the page.
    const twin = document.createElement('div')
    twin.className = 'sr-only chart-table'
    this.tableEl = document.createElement('table')
    twin.append(this.tableEl)
    el.append(this.canvas, twin)
    window.addEventListener(THEME_EVENT, this.onTheme)
    this.ro = new ResizeObserver(() => this.onResize())
    this.ro.observe(this.canvas)
    document.fonts?.ready.then(() => this.draw(true))
  }

  /** Draw `model` (null clears). The first call loads ECharts. */
  async render(model: M | null): Promise<void> {
    this.model = model
    if (!this.chart) {
      const { echarts } = await loadECharts()
      if (this.disposed || this.chart) return this.draw(false)
      this.chart = echarts.init(this.canvas, echartsTheme(this.theme))
      this.chart.on('datazoom', this.onZoomEvent)
    }
    this.draw(false)
  }

  /** Zoom the x axis to [fromMs, toMs] (wall-clock ms) without firing onZoom. */
  zoomTo(fromMs: number, toMs: number): void {
    this.silentZoom = true
    this.chart?.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, startValue: fromMs, endValue: toMs })
    this.silentZoom = false
  }

  dispose(): void {
    this.disposed = true
    clearTimeout(this.zoomTimer)
    window.removeEventListener(THEME_EVENT, this.onTheme)
    this.ro.disconnect()
    this.chart?.dispose()
    this.chart = null
  }

  private readTheme(name: ChartTheme['name']): ChartTheme {
    const style = getComputedStyle(root())
    return readChartTheme(name, (v) => style.getPropertyValue(v))
  }

  private ctx(): ChartContext {
    return { theme: this.theme, width: this.canvas.clientWidth || 800, compact: isCompact() }
  }

  /** Rebuild the option from the model; `keepZoom` carries the current zoom window over. */
  private draw(keepZoom: boolean): void {
    const chart = this.chart
    if (!chart || this.disposed) return
    if (this.model == null) {
      chart.clear()
      this.renderTable(null)
      return
    }
    const option = this.opts.builder(this.model, this.ctx())
    const reduced = reducedMotion()
    // Animate the first draw only; theme/resize redraws should not replay the entrance.
    option.animation = !reduced && !keepZoom
    option.aria = { enabled: true, label: { description: `${this.opts.label}. The data is in the table that follows.` }, decal: { show: false } }
    if (reduced && option.tooltip && !Array.isArray(option.tooltip)) option.tooltip.transitionDuration = 0
    if (keepZoom) carryZoom(chart, option)
    chart.setOption(option, { notMerge: true })
    this.width = this.canvas.clientWidth
    this.renderTable(this.opts.table ? this.opts.table(this.model) : null)
  }

  private renderTable(t: ChartTable | null): void {
    this.tableEl.replaceChildren()
    if (!t) return
    const caption = this.tableEl.createCaption()
    caption.textContent = t.caption
    const head = this.tableEl.createTHead().insertRow()
    for (const c of t.columns) {
      const th = document.createElement('th')
      th.scope = 'col'
      th.textContent = c
      head.append(th)
    }
    const body = this.tableEl.createTBody()
    for (const r of t.rows) {
      const tr = body.insertRow()
      r.forEach((cell, i) => {
        const td = document.createElement(i === 0 ? 'th' : 'td')
        if (i === 0) (td as HTMLTableCellElement).scope = 'row'
        td.textContent = cell
        tr.append(td)
      })
    }
  }

  private onTheme = (e: Event): void => {
    const name = (e as CustomEvent<{ theme?: string }>).detail?.theme
    this.theme = this.readTheme(isTheme(name) ? name : currentTheme())
    this.chart?.setTheme(echartsTheme(this.theme) as never)
    this.draw(true)
  }

  private onResize(): void {
    if (!this.chart) return
    this.chart.resize()
    // Builders lay out some pieces in px (color bars, legend titles): rebuild when the width moves.
    if (Math.abs(this.canvas.clientWidth - this.width) > 1) this.draw(true)
  }

  private onZoomEvent = (): void => {
    if (!this.opts.onZoom || this.silentZoom) return
    clearTimeout(this.zoomTimer)
    this.zoomTimer = window.setTimeout(() => {
      const r = zoomRange(this.chart)
      if (r) this.opts.onZoom?.(r[0], r[1])
    }, ZOOM_DEBOUNCE_MS)
  }
}

/** The first dataZoom's visible [startValue, endValue], or null. */
function zoomRange(chart: ECharts | null): [number, number] | null {
  const dz = (chart?.getOption()?.dataZoom as { startValue?: number; endValue?: number }[] | undefined)?.[0]
  return dz && typeof dz.startValue === 'number' && typeof dz.endValue === 'number' ? [dz.startValue, dz.endValue] : null
}

/** Copy the live zoom percentages onto the new option's dataZoom entries. */
function carryZoom(chart: ECharts, option: EChartsOption): void {
  const live = (chart.getOption()?.dataZoom as { start?: number; end?: number }[] | undefined)?.[0]
  if (!live || !Array.isArray(option.dataZoom)) return
  option.dataZoom = option.dataZoom.map((z) => ({ ...z, start: live.start, end: live.end }))
}

/**
 * `Alpine.data('chart', chart)`: `x-data="chart({ builder, table, label, model: () => …, onZoom })"`.
 * Re-renders whenever what `model()` (or `range()`) reads changes; disposes on destroy.
 */
export function chart<M>(bind: ChartBindings<M>) {
  let host: ChartHost<M> | null = null
  let fx: ReturnType<typeof Alpine.effect> | null = null
  return component({
    init() {
      host = new ChartHost<M>(this.$el as HTMLElement, bind)
      fx = Alpine.effect(() => {
        const m = bind.model()
        const r = bind.range?.()
        const raw = m == null ? null : Alpine.raw(m)
        void host?.render(raw).then(() => r && host?.zoomTo(r[0], r[1]))
      })
    },
    destroy() {
      if (fx) Alpine.release(fx)
      host?.dispose()
      host = null
    },
  })
}
