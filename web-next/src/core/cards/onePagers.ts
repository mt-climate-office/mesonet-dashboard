/**
 * Station one-pager PDFs. `one-pagers.json` on the repo's main branch is a
 * bot-refreshed list of `{station, url}`; the URLs are expiring Airtable
 * attachment links (re-signed every ~1.5–3 h), so callers must keep the cache
 * short and never persist them.
 */

export const ONE_PAGERS_URL =
  'https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/one-pagers.json'

/** How long a fetched list is reused. Well under the link expiry. */
export const ONE_PAGERS_STALE_MS = 30 * 60 * 1000

export interface OnePager {
  station: string
  url: string
}

/** Keep well-formed `{station, url}` entries with http(s) URLs. */
export function parseOnePagers(raw: unknown): OnePager[] {
  if (!Array.isArray(raw)) return []
  const out: OnePager[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { station, url } = item as Record<string, unknown>
    if (typeof station !== 'string' || typeof url !== 'string') continue
    if (!/^https?:\/\//i.test(url)) continue
    out.push({ station, url })
  }
  return out
}

/** The station's one-pager URL (first match, as legacy), or null. */
export function findOnePager(list: readonly OnePager[] | undefined, station: string): string | null {
  return list?.find((p) => p.station === station)?.url ?? null
}

export async function fetchOnePagers(): Promise<OnePager[]> {
  // no-store: the URLs expire, so never let the HTTP cache hand back old ones.
  const r = await fetch(ONE_PAGERS_URL, { cache: 'no-store' })
  if (!r.ok) throw new Error(`one-pagers.json: HTTP ${r.status}`)
  return parseOnePagers(await r.json())
}
