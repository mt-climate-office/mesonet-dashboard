/**
 * Station Metadata card rows (legacy utils/tables.py make_metadata_table, as
 * web/ StationMetadataCard): label/value pairs; a row with `href` renders as
 * a link whose text is `value`.
 */
import type { Station } from '../api'
import { MISSING } from '../charts/format'

export interface MetadataRow {
  label: string
  value: string
  href?: string
}

/** Legacy elevation in feet: round(m × 3.281). */
export const metersToFeet = (m: number): number => Math.round(m * 3.281)

const text = (v: string | null | undefined): string => (v == null || v === '' ? MISSING : v)

/**
 * Legacy rows and order, with the one-pager after Long Name (legacy app.py)
 * when `onePager` is a URL. County and NWSLI ID are web/ extras, kept.
 */
export function metadataRows(s: Station, onePager: string | null): MetadataRow[] {
  return [
    { label: 'Station Name', value: s.station },
    { label: 'Long Name', value: s.name },
    ...(onePager ? [{ label: 'Station One-Pager', value: 'Click to View', href: onePager }] : []),
    { label: 'Date Installed', value: text(s.date_installed) },
    { label: 'Sub Network', value: s.sub_network },
    { label: 'Longitude', value: String(s.longitude) },
    { label: 'Latitude', value: String(s.latitude) },
    { label: 'Elevation (ft)', value: Number.isFinite(s.elevation) ? String(metersToFeet(s.elevation)) : MISSING },
    { label: 'County', value: text(s.county) },
    { label: 'NWSLI ID', value: text(s.nwsli_id) },
  ]
}
