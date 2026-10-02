/**
 * The page's one polite live region (HOUSE-STYLE §5.1), created lazily via
 * `MCO.createLiveRegion`. Call `announce()` for changes a screen reader
 * cannot see (canvas re-renders, tab switches).
 */
let region: { announce(text: string): void } | null = null

/** Announce `text` politely; repeated identical text is re-announced. */
export function announce(text: string): void {
  region ??= MCO.createLiveRegion()
  region.announce('')
  queueMicrotask(() => region?.announce(text))
}
