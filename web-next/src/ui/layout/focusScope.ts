/**
 * Focus scope for drawers and sheets (framework-free; kit candidate, see
 * KIT-NOTES.md): on activate, focus moves into the panel and, when modal, the
 * rest of the page goes `inert`; Esc inside the panel calls `onEscape`; on
 * deactivate, inert is lifted and focus returns to the opener. This is the
 * part of `MCO.initInfoModal` that a non-<dialog> surface has to do itself.
 */

export interface FocusScopeOptions {
  panel: HTMLElement
  /** Elements made inert while a modal scope is active (siblings of the panel, not ancestors). */
  background: () => Element[]
  /** Esc pressed inside the panel and not already handled (e.g. by a combobox popup). */
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
  if (auto) return auto
  const first = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => el.getClientRects().length > 0)
  if (first) return first
  if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1
  return panel
}

export function createFocusScope(o: FocusScopeOptions): FocusScope {
  let active = false
  let opener: HTMLElement | null = null
  let inerted: Element[] = []

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented || !active) return
    e.preventDefault()
    o.onEscape()
  }
  o.panel.addEventListener('keydown', onKey)

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
    activate({ modal, opener: from, focus = true }) {
      active = true
      opener = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
      if (modal) apply()
      else lift()
      if (focus) firstFocusable(o.panel).focus({ preventScroll: true })
    },
    deactivate({ restoreFocus = true } = {}) {
      if (!active) return
      active = false
      lift()
      // Only pull focus back when it is in the panel (or lost); a click elsewhere keeps its target.
      const inside = o.panel.contains(document.activeElement) || document.activeElement === document.body
      if (restoreFocus && inside && opener?.isConnected) opener.focus({ preventScroll: true })
      opener = null
    },
    setModal(modal) {
      if (!active) return
      if (modal) apply()
      else lift()
    },
    destroy() {
      lift()
      o.panel.removeEventListener('keydown', onKey)
    },
  }
}
