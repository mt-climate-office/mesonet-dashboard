/**
 * Freshness of the newest observation for the Now header: the API stamp as a
 * real instant, "Updated N min ago", and the > 2 h stale rule.
 */
import { formatLatestStamp } from '../cards/currentConditions'

const STAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/

/** Data older than this is flagged stale. */
export const STALE_MS = 2 * 60 * 60 * 1000

/**
 * API stamp ("2026-10-01 21:55:00-06:00") → epoch ms, honouring the offset.
 * A stamp without an offset is ambiguous (DST), so it is null like any other
 * unparseable value; the v2 API always sends one.
 */
export function stampEpochMs(ts: unknown): number | null {
  if (typeof ts !== 'string') return null
  const m = STAMP.exec(ts.trim())
  if (!m || !m[7]) return null
  const [, y, mo, d, h, mi, s = '0', off] = m
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)
  if (off === 'Z') return wall
  const sign = off[0] === '-' ? -1 : 1
  const digits = off.slice(1).replace(':', '')
  const offMin = sign * (+digits.slice(0, 2) * 60 + +digits.slice(2))
  return wall - offMin * 60_000
}

/** "Updated just now" · "Updated 7 min ago" · "Updated 3 h ago" (< 48 h) · "Updated Oct 1, 2026 9:55 PM". */
export function updatedText(stamp: string, stampMs: number, nowMs: number): string {
  const min = Math.max(0, Math.floor((nowMs - stampMs) / 60_000))
  if (min < 1) return 'Updated just now'
  if (min < 60) return `Updated ${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 48) return `Updated ${h} h ago`
  return `Updated ${formatLatestStamp(stamp)}`
}

/** True when the observation is more than STALE_MS old. */
export const isStale = (stampMs: number, nowMs: number): boolean => nowMs - stampMs > STALE_MS
