/**
 * Station-map legend: a kit `.mco-panel` (collapsible, collapsed on compact
 * screens) with one text-labelled row per core/map `legendRows` entry.
 * Swatches are aria-hidden decoration; the label carries the meaning.
 */
import type { LegendRow } from '../../core/map'
import { uniqueId } from '../controls/ids'

// A down chevron: the kit turns it up while expanded, so on this top-docked panel it shows the action
// (down = open below, up = fold away); the kit's own up glyph is for bottom-docked panels.
const CHEVRON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'

export interface Legend {
  readonly element: HTMLElement
  render(rows: readonly LegendRow[]): void
}

/** Build the legend panel; place `element` inside the map frame. `collapsed` starts it closed at any width. */
export function createLegend(title = 'Stations', opts: { collapsed?: boolean } = {}): Legend {
  const ids = { title: uniqueId('map-legend-title'), body: uniqueId('map-legend-body') }
  const panel = document.createElement('div')
  panel.className = 'mco-panel map-legend'

  const head = document.createElement('div')
  head.className = 'mco-panel-head'
  const h = document.createElement('span')
  h.className = 'mco-panel-title'
  h.id = ids.title
  h.textContent = title
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'mco-panel-toggle'
  toggle.setAttribute('aria-controls', ids.body)
  toggle.setAttribute('aria-label', 'Map legend')
  toggle.innerHTML = CHEVRON // static markup, no data
  head.append(h, toggle)

  const body = document.createElement('div')
  body.className = 'mco-panel-body'
  body.id = ids.body
  const list = document.createElement('ul')
  list.className = 'map-legend-rows'
  list.setAttribute('aria-labelledby', ids.title)
  body.append(list)
  panel.append(head, body)
  MCO.initCollapsible({ toggle, body, autoCollapseOnCompact: true, startCollapsed: opts.collapsed })

  return {
    element: panel,
    render(rows) {
      list.replaceChildren(
        ...rows.map((r) => {
          const li = document.createElement('li')
          li.className = 'map-legend-row'
          const sw = document.createElement('span')
          sw.className = 'map-legend-swatch'
          sw.setAttribute('aria-hidden', 'true')
          sw.style.background = r.swatch.fill
          sw.style.border = `${r.swatch.strokeWidth}px solid ${r.swatch.stroke}`
          if (r.halo) sw.style.boxShadow = `0 0 0 1.5px var(--bg-surface), 0 0 0 3.5px ${r.halo}`
          const label = document.createElement('span')
          label.textContent = r.label
          li.append(sw, label)
          if (r.count !== null) {
            const n = document.createElement('span')
            n.className = 'map-legend-count'
            n.textContent = `${r.count} ${r.count === 1 ? 'site' : 'sites'}`
            li.append(n)
          }
          return li
        }),
      )
    },
  }
}
