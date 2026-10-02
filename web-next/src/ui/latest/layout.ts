/**
 * `latestLayout`: x-data on the Latest grid (partials/latest/index.html). Holds
 * the sidebar collapse flag (wide screens only; CSS ignores it below 1200 px),
 * persisted in localStorage through core/latest/layout.ts.
 */
import { SIDEBAR_STORAGE_KEY, sidebarCollapsedFrom, sidebarStorageValue } from '../../core/latest'
import { component } from '../component'

/** Storage can throw (private mode, blocked site data): fall back to open / not saved. */
function readCollapsed(): boolean {
  try {
    return sidebarCollapsedFrom(localStorage.getItem(SIDEBAR_STORAGE_KEY))
  } catch {
    return false
  }
}
function saveCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarStorageValue(collapsed))
  } catch {
    /* not persisted; the toggle still works for this page */
  }
}

export function latestLayout() {
  return component({
    sidebarCollapsed: readCollapsed(),

    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed
      saveCollapsed(this.sidebarCollapsed)
      // The pressed button disappears; focus moves to its twin so keyboard users stay in place.
      const next = this.sidebarCollapsed ? 'latest-sidebar-expand' : 'latest-sidebar-collapse'
      this.$nextTick(() => document.getElementById(next)?.focus())
    },
  })
}
