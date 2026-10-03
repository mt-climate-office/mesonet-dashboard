/**
 * Bottom sheet (framework-free; kit candidate `.mco-sheet`, KIT-NOTES.md),
 * after mesonet-explorer's station sheet (app.js:3062-3171) plus the gaps it
 * left: Esc closes, focus moves in and returns to the opener, the background
 * is `inert` while open. Two heights, `peek` and `full`
 * (`data-state`); drag the handle up for full, down to step back to peek and
 * then close; tap or Enter/Space on the handle toggles. `.enter`/`.leaving`
 * drive the slide (220 ms; immediate under reduced motion). The open height
 * is published as `--sheet-h` on <html> so toasts can clear it. `onClosed`
 * runs once the close slide has ended (at once under reduced motion), so
 * content can unmount after it.
 * CSS: ui/layout/sheet.css. Alpine wrappers: ui/picker/stationPicker.ts (the
 * station picker) and ui/shell/sheet.ts (the modal sheets: Download, Custom
 * dates, About's two).
 */
import { createFocusScope } from './focusScope'

export type SheetState = 'peek' | 'full'

export interface SheetOptions {
  panel: HTMLElement
  /** The drag handle: a <button> spanning the sheet head (keyboard toggles peek/full). */
  handle: HTMLElement
  scrim?: HTMLElement | null
  background: () => Element[]
  /** Disclosure buttons; their `aria-expanded` follows the sheet. */
  toggles: () => HTMLElement[]
  onChange?: (open: boolean, state: SheetState) => void
  /** After a close has finished sliding out (not called when reopened mid-slide). */
  onClosed?: () => void
}

export interface Sheet {
  open(opts?: { state?: SheetState; opener?: HTMLElement | null; focus?: boolean }): void
  close(opts?: { restoreFocus?: boolean }): void
  setState(s: SheetState): void
  readonly isOpen: boolean
  readonly state: SheetState
  destroy(): void
}

const SLIDE_MS = 220
const reduced = () => (typeof MCO !== 'undefined' ? MCO.reducedMotion() : matchMedia('(prefers-reduced-motion: reduce)').matches)

export function initSheet(o: SheetOptions): Sheet {
  const { panel, handle } = o
  let open = false
  let state: SheetState = 'peek'
  let leaving = 0
  const scope = createFocusScope({ panel, background: o.background, onEscape: () => api.close() })
  const root = document.documentElement

  const publish = () => root.style.setProperty('--sheet-h', open ? `${panel.offsetHeight}px` : '0px')
  const paint = () => {
    panel.dataset.state = state
    handle.setAttribute('aria-expanded', String(state === 'full'))
    for (const t of o.toggles()) t.setAttribute('aria-expanded', String(open))
    if (o.scrim) o.scrim.hidden = !open
  }

  // Drag on the handle only, so the body keeps its own scrolling.
  let drag: { y0: number; t0: number; h: number; moved: boolean } | null = null
  const onDown = (e: PointerEvent) => {
    drag = { y0: e.clientY, t0: performance.now(), h: panel.offsetHeight, moved: false }
    handle.setPointerCapture(e.pointerId)
    panel.style.transition = 'none'
  }
  const onMove = (e: PointerEvent) => {
    if (!drag) return
    const dy = e.clientY - drag.y0
    if (Math.abs(dy) > 4) drag.moved = true
    if (dy < -24 && state === 'peek') api.setState('full')
    panel.style.transform = `translateY(${Math.max(0, dy)}px)`
  }
  const onUp = (e: PointerEvent) => {
    if (!drag) return
    const { y0, t0, h, moved } = drag
    drag = null
    const dy = e.clientY - y0
    const v = dy / Math.max(1, performance.now() - t0) // px/ms
    panel.style.transition = ''
    panel.style.transform = ''
    if (!moved) return // a tap: the click handler toggles
    handle.dataset.dragged = '1' // swallow the click that follows a drag
    if (dy > Math.min(96, h * 0.3) || v > 0.6) {
      if (state === 'full' && dy < h * 0.6) api.setState('peek')
      else api.close()
    }
  }
  const onClick = () => {
    if (handle.dataset.dragged) {
      delete handle.dataset.dragged
      return
    }
    api.setState(state === 'full' ? 'peek' : 'full')
  }
  const onEnd = (e: TransitionEvent) => {
    if (e.target === panel && e.propertyName === 'max-height') publish()
  }
  const onScrim = () => api.close()
  handle.addEventListener('pointerdown', onDown)
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onUp)
  handle.addEventListener('pointercancel', onUp)
  handle.addEventListener('click', onClick)
  panel.addEventListener('transitionend', onEnd)
  o.scrim?.addEventListener('click', onScrim)

  const api: Sheet = {
    get isOpen() {
      return open
    },
    get state() {
      return state
    },
    open({ state: s = 'peek', opener, focus = true } = {}) {
      clearTimeout(leaving)
      panel.classList.remove('leaving')
      const was = open
      open = true
      state = s
      panel.hidden = false
      paint()
      if (!was && !reduced()) {
        panel.classList.add('enter')
        // Two frames: the first lays out the off-screen start, the second starts the slide.
        requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove('enter')))
      }
      scope.activate({ modal: true, opener, focus })
      publish()
      o.onChange?.(true, state)
    },
    close({ restoreFocus = true } = {}) {
      if (!open) return
      open = false
      paint()
      scope.deactivate({ restoreFocus })
      publish()
      const done = () => {
        panel.hidden = true
        panel.classList.remove('leaving')
        o.onClosed?.()
      }
      if (reduced()) done()
      else {
        panel.classList.add('leaving')
        leaving = window.setTimeout(done, SLIDE_MS)
      }
      o.onChange?.(false, state)
    },
    setState(s) {
      state = s
      paint()
      publish()
      o.onChange?.(open, state)
    },
    destroy() {
      clearTimeout(leaving)
      // Destroyed mid-slide: the classes would hold the next presentation off screen.
      panel.classList.remove('enter', 'leaving')
      scope.destroy()
      handle.removeEventListener('pointerdown', onDown)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      handle.removeEventListener('click', onClick)
      panel.removeEventListener('transitionend', onEnd)
      o.scrim?.removeEventListener('click', onScrim)
      root.style.setProperty('--sheet-h', '0px')
    },
  }
  paint()
  return api
}
