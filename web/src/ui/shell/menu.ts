/**
 * `x-data="menu"`: the Alpine wrapper over ui/layout/menu.ts for any ⋯ menu.
 * Put it on a `.dash-menu` holding one `[data-menu-button]` and one
 * `role="menu"` panel (with an id); items are `role="menuitem"` buttons or
 * links whose `@click` calls the surrounding component. `open` mirrors the
 * state; `close()` closes it from code. Markup: partials/shell.html (header).
 */
import { initMenu, type Menu } from '../layout/menu'
import { component } from '../component'

export function menu() {
  let ctl: Menu | null = null
  return component({
    open: false,
    init() {
      const root = this.$el as HTMLElement
      ctl = initMenu({
        button: root.querySelector<HTMLElement>('[data-menu-button]')!,
        panel: root.querySelector<HTMLElement>('[role="menu"]')!,
        onChange: (open) => (this.open = open),
      })
    },
    close(): void {
      ctl?.close()
    },
    destroy() {
      ctl?.destroy()
      ctl = null
    },
  })
}
