/**
 * The About sheets' scroll hint: `data-more` on a scroll region while it can scroll further down,
 * which about.css draws as a fade over its last rows. Called from the sheets' `x-init`.
 */

/** Keep `data-more` on `el` while content lies below its bottom edge; returns a disposer. */
export function scrollHint(el: HTMLElement): () => void {
  const set = () => el.toggleAttribute('data-more', el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  el.addEventListener('scroll', set, { passive: true })
  // The region resizes with the sheet; its rows render after x-init (and the rain table arrives later).
  const resize = new ResizeObserver(set)
  resize.observe(el)
  const rows = new MutationObserver(set)
  rows.observe(el, { childList: true, subtree: true })
  set()
  return () => {
    el.removeEventListener('scroll', set)
    resize.disconnect()
    rows.disconnect()
  }
}
