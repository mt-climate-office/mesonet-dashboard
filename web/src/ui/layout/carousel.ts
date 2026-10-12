/**
 * Carousel (framework-free; kit candidate `.mco-carousel`, KIT-NOTES.md): a horizontal track of
 * full-width slides that snap (carousel.css), so a touch swipe is the browser's own scroll. Tracks
 * the slide in view (`onIndex`) and scrolls to one (`go`, for the ‹ › buttons and dots, the
 * keyboard and mouse twins of the swipe). Respects reduced motion.
 */
export interface Carousel {
  /** Scroll slide `i` (clamped) into view. */
  go(i: number): void
  destroy(): void
}

export function initCarousel(o: { track: HTMLElement; onIndex: (i: number) => void }): Carousel {
  const { track } = o
  let last = -1
  const index = () => (track.clientWidth ? Math.round(track.scrollLeft / track.clientWidth) : 0)
  const onScroll = () => {
    const i = index()
    if (i !== last) o.onIndex((last = i))
  }
  track.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  return {
    go(i) {
      const n = track.children.length
      const to = Math.max(0, Math.min(n - 1, i))
      track.scrollTo({ left: to * track.clientWidth, behavior: MCO.reducedMotion() ? 'auto' : 'smooth' })
    },
    destroy() {
      track.removeEventListener('scroll', onScroll)
    },
  }
}
