/**
 * Keeps bottom sheets and docked popovers above an on-screen keyboard (framework-free; kit candidate,
 * KIT-NOTES.md). On every visual-viewport resize or scroll it publishes, on <html>, `--kb-inset`
 * (the px the keyboard covers, core/keyboardInset) and `--vv-h` (the visible height), and toggles
 * `.kb-open`; sheet.css, popover.css and picker.css lift and shorten the panels with them. Without
 * `visualViewport` (old browsers) nothing changes. Started once from main.ts.
 */
import { keyboardInset } from '../../core/keyboardInset'

export function initKeyboardInset(): () => void {
  const vv = window.visualViewport
  if (!vv) return () => {}
  const root = document.documentElement
  let last = -1
  const update = () => {
    const inset = keyboardInset(root.clientHeight, vv.height, vv.offsetTop)
    root.style.setProperty('--vv-h', `${Math.round(vv.height)}px`)
    if (inset === last) return
    last = inset
    root.style.setProperty('--kb-inset', `${inset}px`)
    root.classList.toggle('kb-open', inset > 0)
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  update()
  return () => {
    vv.removeEventListener('resize', update)
    vv.removeEventListener('scroll', update)
  }
}
