/**
 * The Download sheet's one short form (partials/downloader/index.html): the
 * summary rows' values, why the form cannot run, and its one primary button.
 * ui/downloader/downloader.ts calls these.
 */
import type { DownloadQuery } from './request'

/** The expandable summary rows (one open at a time). Station is a fixed line, not a row. */
export type FormRow = 'vars' | 'dates' | 'interval' | 'quality'

export const NO_STATION = 'Pick a station in the header first.'
export const NO_VARIABLES = 'Pick at least one variable.'
export const BAD_DATES = 'Fix the dates.'
export const NO_ROWS = 'No data for this selection. Try other dates or variables.'

/** Station line: "Bozeman (acebozem)"; the id alone until the catalog has its name; "None" without one. */
export function stationLine(name: string | undefined, id: string | null): string {
  if (!id) return 'None'
  return name ? `${name} (${id})` : id
}

/** Variables row value: up to two names, then "+ N more"; "None" when empty. */
export function variablesSummary(labels: readonly string[]): string {
  if (labels.length === 0) return 'None'
  const shown = labels.slice(0, 2).join(', ')
  return labels.length > 2 ? `${shown} + ${labels.length - 2} more` : shown
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Sep 1, 2026" from YYYY-MM-DD (parsed by hand: no time zone shift). */
function dayLabel(iso: string, withYear: boolean): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ''}`
}

/** Dates row value: "Sep 1 – Sep 30, 2026", or both years when they differ. */
export function dateRangeLabel(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  return `${dayLabel(start, !sameYear)} – ${dayLabel(end, true)}`
}

/** Why the form cannot preview, in the order to fix it, or null when it can. */
export function formBlocker(i: { station: string | null; elements: readonly string[]; dateError: string | null; rangeValid: boolean }): string | null {
  if (!i.station) return NO_STATION
  if (i.elements.length === 0) return NO_VARIABLES
  return i.dateError ?? (i.rangeValid ? null : BAD_DATES)
}

/** A request's identity: a result belongs to the form while their keys match. */
export const queryKey = (q: DownloadQuery): string => [q.station, q.start, q.end, q.period, q.level, q.elements.join(',')].join('|')

export interface PrimaryAction {
  /** `preview` fetches; `download` saves the fetched rows as CSV. */
  kind: 'preview' | 'download'
  label: string
  /** Clicks do nothing. Shown as aria-disabled, not `disabled`, so the button keeps focus as it changes. */
  disabled: boolean
  /** A preview is loading. */
  busy: boolean
  /** One line under the button saying why it is disabled, or null. */
  reason: string | null
}

/**
 * The form's one button. "Preview" fetches (the first click on a large hourly
 * range arms "Confirm large request" instead); once the current inputs have a
 * result it becomes "Download CSV · N rows", which saves it inside the click's
 * user gesture. Any input change makes it "Preview" again.
 * `rows` is the current result's row count, or null when there is none.
 */
export function primaryAction(s: { blocker: string | null; waiting: boolean; loading: boolean; armed: boolean; rows: number | null }): PrimaryAction {
  if (s.loading) return { kind: 'preview', label: 'Loading preview…', disabled: true, busy: true, reason: null }
  if (s.rows !== null) {
    const n = s.rows.toLocaleString('en-US')
    return { kind: 'download', label: `Download CSV · ${n} ${s.rows === 1 ? 'row' : 'rows'}`, disabled: s.rows === 0, busy: false, reason: s.rows === 0 ? NO_ROWS : null }
  }
  return { kind: 'preview', label: s.armed ? 'Confirm large request' : 'Preview', disabled: s.waiting || s.blocker !== null, busy: false, reason: s.blocker }
}
