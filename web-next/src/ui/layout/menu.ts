/**
 * Menu button (framework-free; kit candidate `.mco-menu`, KIT-NOTES.md), the
 * WAI-ARIA menu-button pattern: a button (`aria-haspopup="menu"`,
 * `aria-expanded`, `aria-controls`) toggles a `role="menu"` panel of
 * `role="menuitem"` items. Opening moves focus to the first item (ArrowUp on
 * the button: the last); ArrowUp/Down, Home/End move between items; Esc
 * closes and returns focus to the button; Tab, a press outside or leaving
 * focus closes. Choosing an item closes the menu, focus back on the button,
 * BEFORE the item's own click handler runs, so a dialog it opens returns
 * focus to the button. Mark an item `data-keep-open` to keep the menu open
 * (the Theme cycle). CSS: ui/layout/menu.css. Alpine wrapper: ui/shell/menu.ts.
 */

export interface MenuOptions {
  button: HTMLElement
  panel: HTMLElement
  /** After every open/close. */
  onChange?: (open: boolean) => void
}

export interface Menu {
  open(focus?: 'first' | 'last'): void
  close(opts?: { focusButton?: boolean }): void
  readonly isOpen: boolean
  destroy(): void
}

const ITEM = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'

export function initMenu(o: MenuOptions): Menu {
  const { button, panel } = o
  let open = false
  const items = () =>
    [...panel.querySelectorAll<HTMLElement>(ITEM)].filter((el) => el.getClientRects().length > 0 && !el.hasAttribute('disabled'))

  button.setAttribute('aria-haspopup', 'menu')
  if (panel.id) button.setAttribute('aria-controls', panel.id)
  for (const el of panel.querySelectorAll<HTMLElement>(ITEM)) el.tabIndex = -1
  // Safari never focuses a clicked button: focus goes to the nearest focusable ancestor instead,
  // and without this that is <main>, so focusout closed the menu before the item's click landed.
  if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1

  const paint = () => {
    panel.hidden = !open
    button.setAttribute('aria-expanded', String(open))
  }
  const move = (to: number) => {
    const list = items()
    if (list.length) list[(to + list.length) % list.length].focus()
  }

  const api: Menu = {
    get isOpen() {
      return open
    },
    open(focus = 'first') {
      open = true
      paint()
      move(focus === 'first' ? 0 : -1)
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
      button.removeEventListener('click', onButtonClick)
      button.removeEventListener('keydown', onButtonKey)
      panel.removeEventListener('keydown', onPanelKey)
      panel.removeEventListener('click', onChoose, true)
      panel.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerdown', onOutside, true)
    },
  }

  const onButtonClick = () => (open ? api.close() : api.open())
  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      api.open(e.key === 'ArrowDown' ? 'first' : 'last')
    }
  }
  const onPanelKey = (e: KeyboardEvent) => {
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') move(i + 1)
    else if (e.key === 'ArrowUp') move(i - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(-1)
    else if (e.key === 'Escape') api.close({ focusButton: true })
    else if (e.key === 'Tab') return api.close()
    else return
    e.preventDefault()
    e.stopPropagation() // Esc here must not also close a sheet or drawer around the menu
  }
  // Capture phase: runs before the item's own handler (see the header).
  const onChoose = (e: MouseEvent) => {
    const item = (e.target as Element).closest<HTMLElement>(ITEM)
    if (item && !item.hasAttribute('data-keep-open')) api.close({ focusButton: true })
  }
  const onFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null
    if (to && !panel.contains(to) && to !== button) api.close()
  }
  const onOutside = (e: PointerEvent) => {
    const t = e.target as Node
    if (open && !panel.contains(t) && !button.contains(t)) api.close()
  }

  button.addEventListener('click', onButtonClick)
  button.addEventListener('keydown', onButtonKey)
  panel.addEventListener('keydown', onPanelKey)
  panel.addEventListener('click', onChoose, true)
  panel.addEventListener('focusout', onFocusOut)
  document.addEventListener('pointerdown', onOutside, true)
  paint()
  return api
}
