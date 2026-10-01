/**
 * Tab registry. App.tsx renders the tab list and panels from this array and
 * lib/useHashTab.ts routes `#<hash>` against it, so adding, reordering or
 * hiding a tab is a one-line change here.
 *
 * - `component` is usually `lazy(...)` so the tab ships as its own chunk;
 *   lazy tabs render inside a Suspense boundary. Set `eager: true` for a tab
 *   imported statically (no Suspense wrapper is added).
 * - `hidden: true` removes the tab from the list *and* from routing: its hash
 *   falls back to DEFAULT_TAB.
 */
import { lazy, type ComponentType } from 'react'
import { LatestDataTab } from '../tabs/LatestDataTab'

export interface TabDef {
  hash: string
  label: string
  component: ComponentType
  /** Statically imported; render without a Suspense boundary. */
  eager?: boolean
  /** Not listed and not routable. */
  hidden?: boolean
}

const AgToolsTab = lazy(() =>
  import('../tabs/AgToolsTab').then((m) => ({ default: m.AgToolsTab })),
)
const DownloaderTab = lazy(() =>
  import('../tabs/DownloaderTab').then((m) => ({ default: m.DownloaderTab })),
)
const SatelliteTab = lazy(() =>
  import('../tabs/SatelliteTab').then((m) => ({ default: m.SatelliteTab })),
)

export const TABS = [
  { hash: 'latest', label: 'Latest Data', component: LatestDataTab, eager: true },
  { hash: 'ag', label: 'Ag Tools', component: AgToolsTab },
  { hash: 'downloader', label: 'Data Downloader', component: DownloaderTab },
  // Hidden in Wave 3 (code kept): `#satellite` falls back to Latest, where
  // GlobalNotices links to the legacy dashboard's satellite view.
  { hash: 'satellite', label: 'Satellite Indicators', component: SatelliteTab, hidden: true },
] as const satisfies readonly TabDef[]

export type TabHash = (typeof TABS)[number]['hash']

export const DEFAULT_TAB: TabHash = 'latest'

/** Tabs that are listed and routable. */
export const VISIBLE_TABS: readonly TabDef[] = (TABS as readonly TabDef[]).filter(
  (t) => !t.hidden,
)
