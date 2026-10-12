/**
 * Screen-reader announcements go through the kit's one polite announcer, `MCO.announce` (HOUSE-STYLE §5.1).
 * Call `announce()` for changes a screen reader cannot see (canvas re-renders, tab switches).
 */

/**
 * Announce `text` politely. The kit clears its region and sets the text a moment later, so a repeat is
 * re-read; the same text twice within 500 ms is heard once.
 */
export function announce(text: string): void {
  MCO.announce(text)
}
