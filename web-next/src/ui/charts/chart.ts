/**
 * The one ECharts host. `ChartHost` owns everything stateful about a chart:
 * lazy ECharts load, init, kit theme (re-read on `mco-theme-change`), resize,
 * reduced motion, zoom in wall-clock ms both ways, the `.sr-only` table twin,
 * dispose. Components use the `chart` Alpine wrapper (usage: core/charts/README.md).
 */
import Alpine from 'alpinejs'
import type { ECharts } from 'echarts'
import { echartsTheme, readChartTheme } from '../../core/charts/theme'
import type { ChartBuilder, ChartContext, ChartTable, ChartTheme } from '../../core/charts/types'
import { type Range, type ViewState, carryState, categoryMs, fromAxisRange, sameRange, toAxisRange } from '../../core/charts/zoom'
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
  /**
   * Optional x range (wall-clock ms), e.g. from the URL. Applied in its own effect (never re-renders)
   * and after each model render; a range equal to the current window is ignored, so echoing
   * `onZoom` back through the URL does not loop.
   */
  range?: () => Range | null | undefined
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
  /** Wall-clock ms per category when the x axis is categorical (heatmaps), else null. */
  private cats: number[] | null = null
  /** Last requested range (wall-clock ms), re-applied after model renders. */
  private range: Range | null = null
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

  /** Draw `model` (null clears), then apply the requested range. The first call loads ECharts. */
  async render(model: M | null): Promise<void> {
    this.model = model
    if (!this.chart) {
      const { echarts } = await loadECharts()
      if (this.disposed) return
      if (!this.chart) {
        this.chart = echarts.init(this.canvas, echartsTheme(this.theme))
        this.chart.on('datazoom', this.onZoomEvent)
      }
    }
    this.draw(false)
    if (this.range) this.zoomTo(this.range[0], this.range[1])
  }

  /** Remember `r` and zoom to it now if the chart is drawn; null forgets it (the zoom stays). */
  setRange(r: Range | null): void {
    this.range = r
    if (r && this.chart && this.model != null) this.zoomTo(r[0], r[1])
  }

  /** Zoom the x axis to [fromMs, toMs] (wall-clock ms) without firing onZoom; no-op if already there. */
  zoomTo(fromMs: number, toMs: number): void {
    if (!this.chart || sameRange(this.visibleRange(), [fromMs, toMs])) return
    const [startValue, endValue] = toAxisRange([fromMs, toMs], this.cats)
    this.silentZoom = true
    this.chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, startValue, endValue })
    this.silentZoom = false
  }

  /** The visible x range in wall-clock ms, or null before the first draw. */
  visibleRange(): Range | null {
    const dz = (this.chart?.getOption()?.dataZoom as { startValue?: number; endValue?: number }[] | undefined)?.[0]
    if (!dz || typeof dz.startValue !== 'number' || typeof dz.endValue !== 'number') return null
    return fromAxisRange([dz.startValue, dz.endValue], this.cats)
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

  /** What a redraw keeps: legend toggles always, the zoom window only for same-data redraws. */
  private viewState(keepZoom: boolean): ViewState {
    const o = this.chart?.getOption() as { dataZoom?: { start?: number; end?: number }[]; legend?: { selected?: Record<string, boolean> }[] } | undefined
    const dz = o?.dataZoom?.[0]
    return {
      zoom: keepZoom && dz ? { start: dz.start, end: dz.end } : undefined,
      selected: o?.legend?.[0]?.selected,
    }
  }

  /** Rebuild the option from the model; `keepZoom` = same data (theme, resize, fonts). */
  private draw(keepZoom: boolean): void {
    const chart = this.chart
    if (!chart || this.disposed) return
    if (this.model == null) {
      chart.clear()
      this.cats = null
      this.renderTable(null)
      return
    }
    const option = carryState(this.opts.builder(this.model, this.ctx()), this.viewState(keepZoom))
    const reduced = reducedMotion()
    // Animate the first draw only; theme/resize redraws should not replay the entrance.
    option.animation = !reduced && !keepZoom
    option.aria = { enabled: true, label: { description: `${this.opts.label}. The data is in the table that follows.` }, decal: { show: false } }
    if (reduced && option.tooltip && !Array.isArray(option.tooltip)) option.tooltip.transitionDuration = 0
    this.cats = categoryMs(option)
    chart.setOption(option, { notMerge: true })
    this.width = this.canvas.clientWidth
    if (!keepZoom) this.renderTable(this.opts.table ? this.opts.table(this.model) : null)
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
      const r = this.visibleRange()
      if (r) this.opts.onZoom?.(r[0], r[1])
    }, ZOOM_DEBOUNCE_MS)
  }
}

/**
 * `Alpine.data('chart', chart)`: `x-data="chart({ builder, table, label, model: () => …, onZoom, range })"`.
 * Two effects: `model()` changes re-render; `range()` changes only zoom. Disposes on destroy.
 */
export function chart<M>(bind: ChartBindings<M>) {
  let host: ChartHost<M> | null = null
  const effects: ReturnType<typeof Alpine.effect>[] = []
  return component({
    init() {
      host = new ChartHost<M>(this.$el as HTMLElement, bind)
      effects.push(
        Alpine.effect(() => {
          const m = bind.model()
          void host?.render(m == null ? null : Alpine.raw(m))
        }),
      )
      if (bind.range) {
        effects.push(
          Alpine.effect(() => {
            const r = bind.range?.()
            host?.setRange(r ? [r[0], r[1]] : null)
          }),
        )
      }
    },
    destroy() {
      effects.forEach((fx) => Alpine.release(fx))
      host?.dispose()
      host = null
    },
  })
}
