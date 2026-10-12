/**
 * Focus scope for drawers and sheets (framework-free; kit candidate, see
 * KIT-NOTES.md): on activate, focus moves into the panel and, when modal, the
 * rest of the page goes `inert`; Esc inside the panel (or, when modal, with focus
 * lost to <body>) calls `onEscape`; on deactivate, inert is lifted and focus
 * returns to the opener. This is the
 * part of `MCO.initInfoModal` that a non-<dialog> surface has to do itself.
 */

export interface FocusScopeOptions {
  panel: HTMLElement
  /** Elements made inert while a modal scope is active (siblings of the panel, not ancestors). */
  background: () => Element[]
  /** Esc pressed inside the panel (or on <body> while modal) and not already handled (e.g. by a combobox popup). */
  onEscape: () => void
}

export interface FocusScope {
  /** `modal` adds `inert` to the background. `opener` gets focus back on deactivate. */
  activate(opts: { modal: boolean; opener?: HTMLElement | null; focus?: boolean }): void
  deactivate(opts?: { restoreFocus?: boolean }): void
  /** Lift or apply `inert` without moving focus (a viewport change switched modal ↔ inline). */
  setModal(modal: boolean): void
  readonly active: boolean
  destroy(): void
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** First element to focus inside `panel`: `[data-autofocus]`, else the first focusable, else the panel. */
export function firstFocusable(panel: HTMLElement): HTMLElement {
  const auto = panel.querySelector<HTMLElement>('[data-autofocus]')
  // Skipped while hidden (the picker's search steps aside for the map on short screens).
  if (auto && auto.getClientRects().length > 0) return auto
  const first = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => el.getClientRects().length > 0)
  if (first) return first
  if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1
  return panel
}

export function createFocusScope(o: FocusScopeOptions): FocusScope {
  let active = false
  let opener: HTMLElement | null = null
  let modal = false
  let inerted: Element[] = []

  // On the document, not the panel: Safari does not focus a clicked button, so a click on one in the
  // panel ("Browse on the map") blurs the search and leaves focus on <body>, outside the panel.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !active) return
    const t = e.target
    const lost = t === document.body || t === document.documentElement
    if (!(t instanceof Node && o.panel.contains(t)) && !(modal && lost)) return
    e.preventDefault()
    o.onEscape()
  }
  document.addEventListener('keydown', onKey)

  const lift = () => {
    inerted.forEach((el) => el.removeAttribute('inert'))
    inerted = []
  }
  const apply = () => {
    lift()
    inerted = o.background().filter((el) => !el.contains(o.panel) && !el.hasAttribute('inert'))
    inerted.forEach((el) => el.setAttribute('inert', ''))
  }

  return {
    get active() {
      return active
    },
    activate({ modal: m, opener: from, focus = true }) {
      active = true
      modal = m
      opener = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
      if (m) apply()
      else lift()
      if (focus) firstFocusable(o.panel).focus({ preventScroll: true })
    },
    deactivate({ restoreFocus = true } = {}) {
      if (!active) return
      active = false
      modal = false
      lift()
      // Only pull focus back when it is in the panel (or lost); a click elsewhere keeps its target.
      const inside = o.panel.contains(document.activeElement) || document.activeElement === document.body
      if (restoreFocus && inside && opener?.isConnected) opener.focus({ preventScroll: true })
      opener = null
    },
    setModal(m) {
      if (!active) return
      modal = m
      if (m) apply()
      else lift()
    },
    destroy() {
      lift()
      document.removeEventListener('keydown', onKey)
    },
  }
}
