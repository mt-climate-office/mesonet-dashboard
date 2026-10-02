/**
 * Latest layout state: whether the controls sidebar is collapsed on wide
 * screens (LDC-002). Persisted per browser in localStorage, not the URL;
 * ui/latest/layout.ts reads and writes it through these helpers.
 */

/** localStorage key (app keys are `mco-dashboard-*`, ARCHITECTURE "Kit usage"). */
export const SIDEBAR_STORAGE_KEY = 'mco-dashboard-sidebar'

const COLLAPSED = 'collapsed'
const OPEN = 'open'

/** Re-validate a stored value: only the exact `collapsed` collapses (null, junk → open). */
export function sidebarCollapsedFrom(raw: string | null | undefined): boolean {
  return raw === COLLAPSED
}

/** The value to store for a collapsed flag. */
export function sidebarStorageValue(collapsed: boolean): string {
  return collapsed ? COLLAPSED : OPEN
}
