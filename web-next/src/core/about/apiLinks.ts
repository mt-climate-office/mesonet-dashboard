/**
 * The About section's API links: the docs and this station's own requests
 * on the public Mesonet API (never the dev proxy), so users can script them.
 */
import { API_DOCS_URL, API_PUBLIC_URL } from '../config'

export interface ApiLink {
  label: string
  href: string
}

/** Docs, then the station's latest reading (CSV) and sensor configuration (JSON). */
export function apiLinks(station: string, base: string = API_PUBLIC_URL): ApiLink[] {
  const s = encodeURIComponent(station)
  return [
    { label: 'Mesonet API documentation', href: API_DOCS_URL },
    { label: 'Latest reading (CSV)', href: `${base}latest?stations=${s}&type=csv` },
    { label: 'Sensor configuration (JSON)', href: `${base}config/${s}/` },
  ]
}
