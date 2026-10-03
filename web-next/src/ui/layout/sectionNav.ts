/**
 * Section navigation (framework-free; kit candidates `.mco-tabbar` and
 * `.mco-section-nav`, KIT-NOTES.md). One behaviour for both the phone bottom
 * tab bar and the desktop segmented row: the links are real `<a href>` (they
 * work without JS, open in a new tab, copy), `aria-current="page"` marks the
 * active one, and a click on one is handed to `onNavigate` with its event, so
 * the app can handle a plain click in-app (push history, view transition) and
 * leave modified clicks to the href. `publishHeight` keeps a CSS custom
 * property on <html> equal to an element's height (0 while hidden), e.g.
 * `--tabbar-h`, which lifts the toast and the bottom sheet above the bar.
 */

export interface SectionNavOptions {
  root: HTMLElement
  /** Called for a click on `a[data-section]`; it calls `preventDefault()` if it handles the click. */
  onNavigate: (e: MouseEvent, section: string, link: HTMLAnchorElement) => void
}

export interface SectionNav {
  /** Mark `section` current (`aria-current="page"`), unmark the rest. */
  setCurrent(section: string): void
  destroy(): void
}

export function initSectionNav(o: SectionNavOptions): SectionNav {
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-section]')
    if (a && o.root.contains(a)) o.onNavigate(e, a.dataset.section ?? '', a)
  }
  o.root.addEventListener('click', onClick)
  return {
    setCurrent(section) {
      for (const a of o.root.querySelectorAll<HTMLAnchorElement>('a[data-section]')) {
        if (a.dataset.section === section) a.setAttribute('aria-current', 'page')
        else a.removeAttribute('aria-current')
      }
    },
    destroy() {
      o.root.removeEventListener('click', onClick)
    },
  }
}

/** Keep `prop` on <html> equal to `el`'s border-box height in px (0 when not rendered). Returns a disposer. */
export function publishHeight(el: HTMLElement, prop: string): () => void {
  const root = document.documentElement
  const set = () => root.style.setProperty(prop, `${el.getClientRects().length ? el.offsetHeight : 0}px`)
  const ro = new ResizeObserver(set)
  ro.observe(el)
  // A display:none ↔ block switch (breakpoint) does not always resize-notify; re-check on viewport changes.
  window.addEventListener('resize', set)
  set()
  return () => {
    ro.disconnect()
    window.removeEventListener('resize', set)
  }
}
