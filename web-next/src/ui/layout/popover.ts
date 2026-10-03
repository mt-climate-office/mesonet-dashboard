/**
 * Popover (framework-free; kit candidate `.mco-popover`, KIT-NOTES.md): a
 * button (`aria-expanded`, `aria-controls`) toggles a non-modal panel
 * (`role="dialog"` with a label) holding form controls, such as an Ag tool's
 * option chip. Opening moves focus to the panel's first control; Esc closes it
 * and returns focus to the button; a press outside, or focus leaving, closes
 * it. Below the button on wide screens, docked at the bottom like a small
 * sheet on phones (CSS: ui/layout/popover.css). Alpine wrapper: ui/shell/popover.ts.
 */
import { firstFocusable } from './focusScope'

export interface PopoverOptions {
  button: HTMLElement
  panel: HTMLElement
  /** After every open/close. */
  onChange?: (open: boolean) => void
}

export interface Popover {
  open(): void
  close(opts?: { focusButton?: boolean }): void
  readonly isOpen: boolean
  destroy(): void
}

export function initPopover(o: PopoverOptions): Popover {
  const { button, panel } = o
  let open = false
  if (panel.id) button.setAttribute('aria-controls', panel.id)
  button.setAttribute('aria-haspopup', 'dialog')

  const paint = () => {
    panel.hidden = !open
    button.setAttribute('aria-expanded', String(open))
  }

  const api: Popover = {
    get isOpen() {
      return open
    },
    open() {
      if (open) return
      open = true
      paint()
      firstFocusable(panel).focus()
      o.onChange?.(true)
    },
    close({ focusButton = false } = {}) {
      if (!open) return
      open = false
      paint()
      if (focusButton) button.focus()
      o.onChange?.(false)
    },
    destroy() {
      button.removeEventListener('click', onButton)
      panel.removeEventListener('keydown', onKey)
      panel.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerdown', onOutside, true)
    },
  }

  const onButton = () => (open ? api.close() : api.open())
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return
    e.preventDefault()
    e.stopPropagation() // Esc here must not also close a sheet or drawer around it
    api.close({ focusButton: true })
  }
  const onFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null
    if (to && !panel.contains(to) && !button.contains(to)) api.close()
  }
  const onOutside = (e: PointerEvent) => {
    const t = e.target as Node
    if (open && !panel.contains(t) && !button.contains(t)) api.close()
  }

  button.addEventListener('click', onButton)
  panel.addEventListener('keydown', onKey)
  panel.addEventListener('focusout', onFocusOut)
  document.addEventListener('pointerdown', onOutside, true)
  paint()
  return api
}
