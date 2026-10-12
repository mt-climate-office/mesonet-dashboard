/**
 * Bottom scroll fade (framework-free): while `el` has more to scroll below, it carries
 * `data-scroll-more` and ui/layout/sheet.css fades its bottom edge, a cue that it scrolls (macOS hides
 * scrollbars). Used by the modal sheets' bodies (ui/shell/sheet.ts), the About sheets' tables, the Download checklist and the Help and photo dialogs.
 * Returns the cleanup.
 */
export function initScrollFade(el: HTMLElement): () => void {
  const update = () => el.toggleAttribute('data-scroll-more', el.scrollHeight - el.clientHeight - el.scrollTop > 1)
  // The scroller's size and its children's sizes decide whether there is more; content mounts later.
  const ro = new ResizeObserver(update)
  const observeChildren = () => {
    for (const c of el.children) ro.observe(c)
    update()
  }
  const mo = new MutationObserver(observeChildren)
  ro.observe(el)
  mo.observe(el, { childList: true })
  observeChildren()
  el.addEventListener('scroll', update, { passive: true })
  return () => {
    ro.disconnect()
    mo.disconnect()
    el.removeEventListener('scroll', update)
  }
}
