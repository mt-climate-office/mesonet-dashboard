/** Row preparation for the Downloader preview chart: gap rows in station wall time. */
import type { ObservationRow } from '../api'
import { insertGaps } from '../gaps'

type Row = Record<string, unknown>

/** "2026-08-28 00:00:00-06:00" → "2026-08-28T00:00:00-06:00" (cross-browser Date.parse). */
const isoT = (v: unknown) => (typeof v === 'string' ? v.replace(' ', 'T') : v)

/** Wall-clock ms of an API datetime (offset ignored, as the charts do). */
const wallMs = (s: string) => Date.parse(`${s.slice(0, 19).replace(' ', 'T')}Z`)
const fmtWall = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')

/**
 * Break lines at missing timestamps via `insertGaps`. That helper stamps its
 * synthetic rows with UTC ISO strings, but the charts ignore UTC offsets and
 * plots wall time, so each synthetic x is re-expressed in the station's
 * local wall time (previous real sample + one cadence); otherwise it would
 * land 6–7 h off and, for hourly data, past the next real sample.
 */
export function withGaps(rows: ReadonlyArray<Row>): Row[] {
  const normalised = rows.map((r) => ({ ...r, datetime: isoT(r.datetime) })) as ObservationRow[]
  const real = new Set<unknown>(normalised)
  const gapped = insertGaps(normalised)
  const out: Row[] = []
  let prev: ObservationRow | undefined
  for (const r of gapped) {
    if (real.has(r)) {
      prev = r
      out.push(r)
      continue
    }
    if (!prev) {
      out.push(r)
      continue
    }
    const step = Date.parse(String(r.datetime)) - Date.parse(String(prev.datetime))
    out.push({ ...r, datetime: fmtWall(wallMs(String(prev.datetime)) + step) })
  }
  return out
}
