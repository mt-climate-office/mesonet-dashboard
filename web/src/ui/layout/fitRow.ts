/**
 * One-line row (framework-free): of a wrapping flex row's children, those that would wrap onto a
 * second line are `hidden`, so the row shows as many whole items as its width allows (Now's forecast
 * icons, x-data="fitRow"). Re-fits when the width, the children or the loaded fonts change. Returns the cleanup.
 */
export function initFitRow(el: HTMLElement): () => void {
  let width = -1
  const fit = () => {
    const items = [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.tagName !== 'TEMPLATE')
    for (const i of items) i.hidden = false
    const top = items[0]?.offsetTop ?? 0
    // Read every position before writing any, so one layout pass decides them all.
    const wraps = items.map((i) => i.offsetTop > top)
    items.forEach((i, k) => (i.hidden = wraps[k]))
  }
  const ro = new ResizeObserver(() => {
    if (el.clientWidth === width) return // hiding items changes only the height
    width = el.clientWidth
    fit()
  })
  const mo = new MutationObserver(fit)
  ro.observe(el)
  mo.observe(el, { childList: true })
  void document.fonts?.ready.then(fit)
  fit()
  return () => {
    ro.disconnect()
    mo.disconnect()
  }
}
