/**
 * Tab registry: the routable `#hash` tabs, in display order. The shell
 * renders its tab buttons from `partials/shell.html`; this list is what the
 * URL store routes against, so hiding a tab is a one-line change here plus
 * removing its button.
 */

export const TABS = [
  { hash: 'latest', label: 'Latest Data' },
  { hash: 'ag', label: 'Ag Tools' },
  { hash: 'downloader', label: 'Data Downloader' },
  // Hidden: `#satellite` falls back to Latest (the legacy dashboard keeps it).
  { hash: 'satellite', label: 'Satellite Indicators', hidden: true },
] as const

export type TabHash = (typeof TABS)[number]['hash']

export const DEFAULT_TAB: TabHash = 'latest'

/** Hashes that are listed and routable. */
export const VISIBLE_TAB_HASHES: readonly TabHash[] = TABS.filter(
  (t) => !('hidden' in t && t.hidden),
).map((t) => t.hash)

/** `#ag` / `ag` → 'ag'; unknown or hidden hashes → DEFAULT_TAB. */
export function parseTabHash(hash: string): TabHash {
  const raw = hash.replace(/^#/, '').trim()
  return (VISIBLE_TAB_HASHES as readonly string[]).includes(raw) ? (raw as TabHash) : DEFAULT_TAB
}
