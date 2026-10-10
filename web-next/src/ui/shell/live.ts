/**
 * The page's one polite live region (HOUSE-STYLE §5.1), created lazily via
 * `MCO.createLiveRegion`. Call `announce()` for changes a screen reader
 * cannot see (canvas re-renders, tab switches).
 */
let region: { announce(text: string): void } | null = null

/**
 * Announce `text` politely; repeated identical text is re-announced (the kit clears the region and sets
 * the text after a short gap, since 0.8.0, so the text lands a moment later).
 */
export function announce(text: string): void {
  region ??= MCO.createLiveRegion()
  region.announce(text)
}
