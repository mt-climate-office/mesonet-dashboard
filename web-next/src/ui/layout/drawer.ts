/**
 * Side drawer (framework-free; kit candidate `.mco-drawer`, KIT-NOTES.md).
 * Two presentations, chosen per call by `overlay()`:
 *  - inline:  in the page's flex row, slides by `margin-inline-start` (the
 *             content reflows; mesonet-explorer's sidebar). Not modal.
 *  - overlay: fixed over the content with a scrim; modal (background inert).
 * Closed drawers are `visibility: hidden` (out of the tab order and the AT
 * tree, after the slide). Esc closes; focus moves in on open and back on close.
 * CSS: ui/layout/drawer.css. The Alpine wrapper is ui/picker/stationPicker.ts.
 */
import { createFocusScope, type FocusScope } from './focusScope'

export interface DrawerOptions {
  panel: HTMLElement
  /** Disclosure buttons; their `aria-expanded` follows the drawer. */
  toggles: () => HTMLElement[]
  scrim?: HTMLElement | null
  /** True when the drawer should be an overlay right now (e.g. below the desktop breakpoint). */
  overlay: () => boolean
  /** Elements made inert while the overlay is open. */
  background: () => Element[]
  /** After every open/close (persist the inline preference here). */
  onChange?: (open: boolean) => void
}

export interface Drawer {
  open(opts?: { opener?: HTMLElement | null; focus?: boolean }): void
  close(opts?: { restoreFocus?: boolean }): void
  toggle(opener?: HTMLElement | null): void
  readonly isOpen: boolean
  /** Re-apply the presentation after a viewport change (keeps the open state). */
  sync(): void
  destroy(): void
}

export function initDrawer(o: DrawerOptions): Drawer {
  let open = false
  const scope: FocusScope = createFocusScope({ panel: o.panel, background: o.background, onEscape: () => api.close() })
  const onScrim = () => api.close()
  o.scrim?.addEventListener('click', onScrim)

  const paint = () => {
    const overlay = o.overlay()
    o.panel.dataset.presentation = overlay ? 'overlay' : 'inline'
    o.panel.classList.toggle('is-open', open)
    // visibility:hidden alone is not enough: descendants that set `visibility: visible`
    // (MapLibre's compact attribution does) stay focusable. inert closes that hole.
    o.panel.inert = !open
    if (o.scrim) o.scrim.hidden = !(open && overlay)
    for (const t of o.toggles()) t.setAttribute('aria-expanded', String(open))
  }

  const api: Drawer = {
    get isOpen() {
      return open
    },
    open({ opener, focus = true } = {}) {
      open = true
      paint()
      scope.activate({ modal: o.overlay(), opener, focus })
      o.onChange?.(true)
    },
    close({ restoreFocus = true } = {}) {
      if (!open) return
      open = false
      paint()
      scope.deactivate({ restoreFocus })
      o.onChange?.(false)
    },
    toggle(opener) {
      if (open) api.close()
      else api.open({ opener })
    },
    sync() {
      paint()
      scope.setModal(open && o.overlay())
    },
    destroy() {
      scope.destroy()
      o.scrim?.removeEventListener('click', onScrim)
    },
  }
  paint()
  return api
}
