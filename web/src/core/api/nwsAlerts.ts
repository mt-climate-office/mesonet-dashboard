/**
 * Active NWS hazard alerts (warnings, watches, advisories) for a point, from
 * api.weather.gov `/alerts/active?point=`. Now shows them as banners above the
 * current conditions (core/overview/alerts.ts).
 */
import { parseWallClock } from '../sensorEvents'
import { getGeoJson, NWS } from './nwsForecast'

export interface NwsAlert {
  id: string
  /** "Winter Storm Warning". */
  event: string
  /** NWS headline ("Winter Storm Warning issued October 12 at 3:14AM MDT until …"), or "". */
  headline: string
  /** CAP severity: Extreme, Severe, Moderate, Minor or Unknown. */
  severity: string
  /** When the hazard begins and ends, Denver wall-clock ms (core/sensorEvents); null when NWS gives none. */
  onset: number | null
  ends: number | null
  /** What and when, then what to do: paragraphs split by a blank line, each on one line; "" when none. */
  description: string
  instruction: string
}

interface AlertsResponse {
  features?: {
    properties?: {
      id?: string
      event?: string
      headline?: string | null
      severity?: string
      status?: string
      messageType?: string
      onset?: string | null
      effective?: string | null
      ends?: string | null
      expires?: string | null
      description?: string | null
      instruction?: string | null
    }
  }[]
}

/** NWS text hard-wraps near 70 columns: join the lines of each paragraph, keep blank-line breaks. */
const unwrap = (t: string | null | undefined): string =>
  (t ?? '')
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')

/**
 * `/alerts/active` GeoJSON → the actual (not test or exercise), uncancelled
 * alerts; one per event and end time (a point inside both a county and a zone
 * can get the same alert twice). NWS stamps carry the local offset, so the
 * wall-clock reading is Denver time.
 */
export function parseNwsAlerts(json: unknown): NwsAlert[] {
  const out = new Map<string, NwsAlert>()
  for (const f of (json as AlertsResponse | null)?.features ?? []) {
    const p = f.properties
    if (!p?.event || p.status !== 'Actual' || p.messageType === 'Cancel') continue
    const a: NwsAlert = {
      id: p.id ?? p.event,
      event: p.event,
      headline: p.headline ?? '',
      severity: p.severity ?? 'Unknown',
      onset: parseWallClock(p.onset ?? p.effective),
      ends: parseWallClock(p.ends ?? p.expires),
      description: unwrap(p.description),
      instruction: unwrap(p.instruction),
    }
    const key = `${a.event}|${a.ends}`
    if (!out.has(key)) out.set(key, a)
  }
  return [...out.values()]
}

/** Active alerts for a point (decimal degrees). Throws `HttpError` on non-2xx. */
export async function fetchNwsAlerts(latitude: number, longitude: number): Promise<NwsAlert[]> {
  return parseNwsAlerts(await getGeoJson<unknown>(`${NWS}/alerts/active?point=${latitude},${longitude}`))
}
