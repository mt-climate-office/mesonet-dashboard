/**
 * Horizontal swipe on a chart page (framework-free): a touch pointer that
 * travels sideways far enough (core/swipe `swipeStep`) calls `onStep(-1 | 1)`.
 * The page needs `touch-action: pan-y pinch-zoom` (charts.css `.chart-page`)
 * so the browser keeps vertical scrolling and leaves sideways travel to us; a
 * gesture the browser takes over (pointercancel) is dropped. Gestures that
 * start in a `[data-no-swipe]` element (a scrolling chip row, a table) are
 * ignored. Mouse and pen never swipe; the ⋯ menu is the keyboard twin.
 */
import { swipeStep } from '../../core/swipe'

export function initSwipe(o: { el: HTMLElement; onStep: (step: -1 | 1) => void }): () => void {
  let start: { id: number; x: number; y: number } | null = null
  const down = (e: PointerEvent) => {
    const skip = e.pointerType !== 'touch' || !e.isPrimary || (e.target as Element).closest('[data-no-swipe]')
    start = skip ? null : { id: e.pointerId, x: e.clientX, y: e.clientY }
  }
  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return
    const step = swipeStep(e.clientX - start.x, e.clientY - start.y)
    start = null
    if (step) o.onStep(step)
  }
  const cancel = () => (start = null)
  o.el.addEventListener('pointerdown', down)
  o.el.addEventListener('pointerup', up)
  o.el.addEventListener('pointercancel', cancel)
  return () => {
    o.el.removeEventListener('pointerdown', down)
    o.el.removeEventListener('pointerup', up)
    o.el.removeEventListener('pointercancel', cancel)
  }
}
