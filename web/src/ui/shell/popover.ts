/**
 * `x-data="popover"`: the Alpine wrapper over ui/layout/popover.ts. Put it on
 * a `.dash-popover` holding one `[data-popover-button]` and one
 * `role="dialog"` panel (with an id and a label). `popoverOpen` mirrors the
 * state; `closePopover()` closes it from a control inside (focus back on the
 * button), e.g. after a single choice. Markup: partials/ag/options.html.
 */
import { initPopover, type Popover } from '../layout/popover'
import { component } from '../component'

export function popover() {
  let ctl: Popover | null = null
  return component({
    popoverOpen: false,
    init() {
      const root = this.$el as HTMLElement
      ctl = initPopover({
        button: root.querySelector<HTMLElement>('[data-popover-button]')!,
        panel: root.querySelector<HTMLElement>('[role="dialog"]')!,
        onChange: (open) => (this.popoverOpen = open),
      })
    },
    closePopover(): void {
      ctl?.close({ focusButton: true })
    },
    destroy() {
      ctl?.destroy()
      ctl = null
    },
  })
}
