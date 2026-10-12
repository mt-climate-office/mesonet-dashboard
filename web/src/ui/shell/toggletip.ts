/**
 * `x-data="toggletip"` on a `.dash-toggletip` wrapper: connects its
 * `.dash-toggletip-btn` and `.dash-toggletip-tip` to ui/layout/toggletip.ts.
 * Used by the Now freshness line (partials/now/index.html, "Provisional").
 */
import { initToggletip, type Toggletip } from '../layout/toggletip'
import { component } from '../component'

export function toggletip() {
  let tip: Toggletip | null = null
  return component({
    init() {
      // Queried, not $refs: child x-refs are not registered yet when init() runs.
      const el = this.$el as HTMLElement
      tip = initToggletip({ button: el.querySelector<HTMLElement>('.dash-toggletip-btn')!, tip: el.querySelector<HTMLElement>('.dash-toggletip-tip')! })
    },
    destroy() {
      tip?.destroy()
      tip = null
    },
  })
}
