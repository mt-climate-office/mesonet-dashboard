/**
 * How far an on-screen keyboard covers the bottom of the page, from the visual viewport. iOS Safari
 * shrinks the visual viewport when the keyboard opens but leaves the layout viewport (what
 * `position: fixed; bottom: 0` anchors to) as it was, so bottom sheets end up under the keyboard.
 * ui/layout/keyboard.ts publishes this as `--kb-inset`. Pure.
 */

/** Below this (px), a viewport change is browser chrome (a toolbar showing or hiding), not a keyboard. */
export const KEYBOARD_MIN_PX = 80

/**
 * px between the bottom of the visible area and the bottom of the layout viewport; 0 when that is
 * under `KEYBOARD_MIN_PX`. `layoutHeight` is `document.documentElement.clientHeight`; `vvHeight`
 * and `vvOffsetTop` are `visualViewport.height` / `.offsetTop` (the page may be panned up).
 */
export function keyboardInset(layoutHeight: number, vvHeight: number, vvOffsetTop: number): number {
  const inset = Math.round(layoutHeight - vvHeight - vvOffsetTop)
  return inset >= KEYBOARD_MIN_PX ? inset : 0
}
