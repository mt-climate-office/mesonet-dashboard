/**
 * `x-data="fitRow"` on a wrapping flex row (Now's forecast icons, partials/now/hero.html): shows only
 * the children that fit on its first line (ui/layout/fitRow.ts).
 */
import { initFitRow } from '../layout/fitRow'
import { component } from '../component'

export function fitRow() {
  let cleanup: (() => void) | null = null
  return component({
    init() {
      cleanup = initFitRow(this.$el as HTMLElement)
    },
    destroy() {
      cleanup?.()
    },
  })
}
