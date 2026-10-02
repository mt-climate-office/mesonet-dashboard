/**
 * Text for the app-wide notices (ui/shell/globalNotices.ts): the inline
 * banners for legacy `?state=` links and `#satellite`, their short toast
 * twins, and the live-region line for a resolved NWSLI / mis-cased `?s=`.
 */
import type { Station } from './api'
import { LEGACY_DASHBOARD_URL } from './config'
import { legacyStateUrl } from './legacyLinks'
import { resolveStationId } from './stations'

/** A dismissible banner: a sentence, then a link that opens in a new tab. */
export interface Notice {
  id: 'legacy-state' | 'satellite'
  text: string
  linkText: string
  href: string
  /** Plain-text toast (the kit toast cannot hold a link). */
  toast: string
}

export const SATELLITE_HASH = '#satellite'

/** The legacy dashboard's satellite view, which this app does not carry. */
export const LEGACY_SATELLITE_URL = `${LEGACY_DASHBOARD_URL}${SATELLITE_HASH}`

/** Banner for a `?state=<hash>` link from the legacy dashboard. */
export function legacyStateNotice(hash: string): Notice {
  return {
    id: 'legacy-state',
    text: 'This link was shared from the previous dashboard, so its saved layout can’t be restored here. We kept what we could, such as the station.',
    linkText: 'Open the saved layout in the previous dashboard',
    href: legacyStateUrl(LEGACY_DASHBOARD_URL, hash),
    toast: 'Opened from an older shared link. See the notice at the top of the page.',
  }
}

/** Banner for `#satellite`: the tab is hidden, so the page shows Latest Data. */
export function satelliteNotice(): Notice {
  return {
    id: 'satellite',
    text: 'Satellite indicators aren’t in this dashboard yet, so you’re on Latest Data.',
    linkText: 'Open satellite indicators in the previous dashboard',
    href: LEGACY_SATELLITE_URL,
    toast: 'Satellite indicators are on the previous dashboard. See the notice at the top of the page.',
  }
}

/**
 * Live-region line for the page-load `?s=<raw>` once the catalog is in: set
 * only when `$store.station` rewrites it to a different catalog id (NWSLI or
 * case mismatch). An exact id, an unknown id or no catalog → null.
 */
export function stationResolvedMessage(
  raw: string | null,
  stations: readonly Pick<Station, 'station' | 'name' | 'nwsli_id'>[] | undefined,
): string | null {
  if (!raw || !stations) return null
  const id = resolveStationId(raw, stations)
  if (!id || id === raw) return null
  const row = stations.find((s) => s.station === id)
  return `Station ${raw.trim()} opened as ${row?.name ?? id} (${id}).`
}
