/**
 * Toggletip (framework-free; kit candidate `.mco-toggletip`, KIT-NOTES.md): an
 * info button that shows a short note on click or tap. The button carries
 * `aria-expanded` + `aria-controls`; the note follows it in the DOM, so a
 * screen reader reads it next. Esc or a press outside closes it.
 * CSS: ui/layout/toggletip.css. The Alpine wrapper is ui/shell/toggletip.ts.
 */

export interface ToggletipOptions {
  button: HTMLElement
  /** The note; `hidden` while closed. */
  tip: HTMLElement
}

export interface Toggletip {
  close(): void
  destroy(): void
}

export function initToggletip({ button, tip }: ToggletipOptions): Toggletip {
  const isOpen = () => button.getAttribute('aria-expanded') === 'true'
  const set = (open: boolean) => {
    button.setAttribute('aria-expanded', String(open))
    tip.hidden = !open
  }
  const onClick = () => set(!isOpen())
  // Not preventDefault: an Esc meant for something else (a dialog) still reaches it.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen()) set(false)
  }
  const onPointer = (e: PointerEvent) => {
    const t = e.target as Node
    if (isOpen() && !button.contains(t) && !tip.contains(t)) set(false)
  }

  button.addEventListener('click', onClick)
  document.addEventListener('keydown', onKey)
  document.addEventListener('pointerdown', onPointer)
  set(false)
  return {
    close: () => set(false),
    destroy() {
      button.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    },
  }
}
