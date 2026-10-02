/**
 * Text helpers shared by every builder: Plotly-markup labels → plain text,
 * HTML escaping for tooltips, and Denver wall-clock / number formatting for
 * tooltips and the sr-only table twins.
 */
import type { Nullable } from '../ag/contract'
import { parseWallClock } from '../sensorEvents'

export type Period = 'daily' | 'hourly'

/** Missing cell text in tables and tooltips. */
export const MISSING = '—'

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺',
}

/**
 * Axis title from core/params text: `<br>` → newline, `<sup>-1</sup>` →
 * Unicode superscripts, other tags (`<b>`) dropped, whitespace trimmed.
 */
export function plainLabel(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<sup>([^<]*)<\/sup>/gi, (_, x: string) => [...x].map((c) => SUP[c] ?? c).join(''))
    .replace(/<[^>]+>/g, '')
    .trim()
}

/** Escape text for tooltip HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/**
 * Contract local time (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`) → Denver
 * wall-clock ms. Daily rows sit at local noon so a bar fills its own day.
 */
export function wallMs(t: string): number {
  const ms = parseWallClock(t)
  if (ms === null) throw new Error(`wallMs: bad local time "${t}"`)
  return t.length <= 10 ? ms + 12 * 3_600_000 : ms
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

/** Wall-clock ms → "Jul 1, 2025" (daily) or "Jul 1, 2025 14:00" (hourly). Mountain Time by construction. */
export function fmtWall(ms: number, period: Period): string {
  const d = new Date(ms)
  const day = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
  return period === 'hourly' ? `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day
}

/** Wall-clock ms → ISO-like "2025-07-01" / "2025-07-01 14:00" for table cells (sortable, unambiguous). */
export function isoWall(ms: number, period: Period): string {
  const d = new Date(ms)
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  return period === 'hourly' ? `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day
}

/** Fixed-decimal number, or "—" for null / non-finite. */
export function fmtNum(v: Nullable | undefined, digits: number): string {
  return v == null || !Number.isFinite(v) ? MISSING : v.toFixed(digits)
}
