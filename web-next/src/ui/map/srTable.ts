/**
 * `.sr-only` table twin of the station layer (HOUSE-STYLE §5.2): visible
 * stations (name, network, county), each name a button that selects it.
 * One Tab stop (roving tabindex; arrows/Home/End move); focus drives the map's popup.
 */
import type { StationRow } from '../../core/map'

export interface SrTableOptions {
  caption: string
  onSelect(id: string): void
  /** A station button gained focus (id) or focus left the table (null). */
  onFocus(id: string | null): void
}

export interface SrTable {
  /** Visually hidden wrapper (a <table> ignores .sr-only's 1 px height). */
  readonly element: HTMLElement
  render(rows: readonly StationRow[], selected: string | null): void
}

const cell = (tag: 'td' | 'th', text: string) => {
  const el = document.createElement(tag)
  el.textContent = text
  return el
}

/** Build the twin table; place `element` inside the map frame. */
export function createSrTable(opts: SrTableOptions): SrTable {
  const wrap = document.createElement('div')
  wrap.className = 'sr-only'
  const table = document.createElement('table')
  wrap.append(table)
  const caption = document.createElement('caption')
  const head = document.createElement('thead')
  const hr = document.createElement('tr')
  for (const h of ['Station', 'Network', 'County']) {
    const th = cell('th', h)
    th.scope = 'col'
    hr.append(th)
  }
  head.append(hr)
  const body = document.createElement('tbody')
  table.append(caption, head, body)

  let shownIds = ''
  const buttons = () => [...body.querySelectorAll<HTMLButtonElement>('button')]

  // Exactly one button is tabbable: the selected one, else the first.
  const setRoving = (selected: string | null) => {
    const all = buttons()
    const current = all.find((b) => b.dataset.id === selected) ?? all[0]
    for (const b of all) {
      b.tabIndex = b === current ? 0 : -1
      if (b.dataset.id === selected) b.setAttribute('aria-current', 'true')
      else b.removeAttribute('aria-current')
    }
  }

  body.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest('button')?.dataset.id
    if (id) opts.onSelect(id)
  })
  body.addEventListener('focusin', (e) => {
    const id = (e.target as HTMLElement).closest('button')?.dataset.id
    if (id) opts.onFocus(id)
  })
  table.addEventListener('focusout', (e) => {
    if (!table.contains(e.relatedTarget as Node | null)) opts.onFocus(null)
  })
  body.addEventListener('keydown', (e) => {
    const all = buttons()
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    const next = all[Math.max(0, Math.min(all.length - 1, to))]
    for (const b of all) b.tabIndex = b === next ? 0 : -1
    next.focus()
  })

  return {
    element: wrap,
    render(rows, selected) {
      caption.textContent = `${opts.caption} (${rows.length})`
      const ids = rows.map((r) => r.id).join(',')
      if (ids !== shownIds) {
        // Rebuild only when the station set changes, so focus survives a selection.
        const active = document.activeElement as HTMLElement | null
        const focused = active && table.contains(active) ? active.dataset.id : undefined
        shownIds = ids
        body.replaceChildren(
          ...rows.map((r) => {
            const tr = document.createElement('tr')
            const th = document.createElement('th')
            th.scope = 'row'
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.dataset.id = r.id
            btn.textContent = `${r.name} (${r.id})`
            th.append(btn)
            tr.append(th, cell('td', r.network), cell('td', r.county))
            return tr
          }),
        )
        if (focused) buttons().find((b) => b.dataset.id === focused)?.focus()
      }
      setRoving(selected)
    },
  }
}
