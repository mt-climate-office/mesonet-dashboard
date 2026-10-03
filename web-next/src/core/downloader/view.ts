/**
 * Data Downloader view logic (what web/ DownloaderTab.tsx computed inline):
 * picker options, selection pruning, QC level, the date window and
 * announcement text. ui/downloader/downloader.ts calls these; the form's
 * rows and button are in form.ts.
 */
import type { Station, StationElement } from '../api'
import type { MultiselectGroup, MultiselectOption } from '../controls/multiselectModel'
import type { DlPeriod } from '../url-schema'
import { elementLabel } from './labels'
import {
  clampStart,
  dateRangeError,
  daySpan,
  DEFAULT_QC_LEVEL,
  DERIVED_CODES,
  DERIVED_OPTIONS,
  derivedOptionsFor,
  HOURLY_CONFIRM_DAYS,
  HOURLY_DEFAULT_DAYS,
  type QcLevel,
  SWP_CODES,
} from './request'

/** The Interval row, finest first. Legacy offered no raw (5-min) download; neither does this. */
export const PERIOD_OPTIONS: ReadonlyArray<{ value: DlPeriod; label: string }> = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
]

export const MONTHLY_NOTE =
  'Monthly values are computed from daily data: precipitation and Reference ET are summed, other variables averaged. "Days With Data" shows how many days each month includes. Totals are left blank for any month missing a day (including months only partly inside the date range).'

/** Station install date as YYYY-MM-DD, or null. */
export function installDateOf(s: Station | undefined): string | null {
  return s?.date_installed ? String(s.date_installed).slice(0, 10) : null
}

/** Measured-variable options (the API's standard elements): unique, derived codes excluded, US-unit labels, natural sort. */
export function standardOptions(elements: readonly StationElement[]): MultiselectOption[] {
  const seen = new Set<string>()
  const out: MultiselectOption[] = []
  for (const e of elements) {
    if (seen.has(e.element) || DERIVED_CODES.has(e.element)) continue
    seen.add(e.element)
    out.push({ value: e.element, label: elementLabel(e.description_short) })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
}

/** The two picker groups; SWP-only derived variables only at `has_swp` stations. */
export function elementGroups(standard: MultiselectOption[], hasSwp: boolean): MultiselectGroup[] {
  return [
    { id: 'standard', label: 'Measured variables', options: standard },
    { id: 'derived', label: 'Derived variables', options: derivedOptionsFor(hasSwp).map((o) => ({ value: o.value, label: o.label })) },
  ]
}

/**
 * The selection a request uses, from the URL's `els` (order kept). SWP-only
 * codes are dropped once the station is known to lack SWP parameters
 * (`droppedSwp`, shown as a notice); standard codes the station does not
 * offer are dropped once its list has loaded (`standard` non-null).
 */
export function pruneSelection(
  els: readonly string[],
  o: { stationKnown: boolean; hasSwp: boolean; standard: readonly MultiselectOption[] | null },
): { selected: string[]; droppedSwp: string[] } {
  let selected = [...els]
  let droppedSwp: string[] = []
  if (o.stationKnown && !o.hasSwp) {
    droppedSwp = selected.filter((e) => SWP_CODES.has(e))
    selected = selected.filter((e) => !SWP_CODES.has(e))
  }
  if (o.standard) {
    const valid = new Set(o.standard.map((x) => x.value))
    selected = selected.filter((e) => DERIVED_CODES.has(e) || valid.has(e))
  }
  return { selected, droppedSwp }
}

/** Notice for SWP-only codes removed at a non-SWP station. */
export function droppedSwpNotice(dropped: readonly string[], stationName: string): string {
  const label = (c: string) => DERIVED_OPTIONS.find((o) => o.value === c)?.label ?? c
  // Sentence case: names after the first start lower case ("Soil water potential and soil saturation").
  const names = dropped.map((c, i) => (i ? label(c).charAt(0).toLowerCase() + label(c).slice(1) : label(c))).join(' and ')
  const many = dropped.length > 1
  return `${names} ${many ? 'are' : 'is'} not available at ${stationName} (no soil water potential parameters), so ${many ? 'they were' : 'it was'} removed from the request.`
}

/** QC level: explicit `qc`, else legacy `rmna=true` → 2, else the default (2). */
export function qcLevelOf(qc: QcLevel | null, rmna: boolean): QcLevel {
  return qc ?? (rmna ? 2 : DEFAULT_QC_LEVEL)
}

/** `iso` (YYYY-MM-DD) shifted by `days` calendar days. */
export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export interface DateWindow {
  /** Effective start (clamped to the install date). */
  start: string
  end: string
  /** The start was moved up to the install date. */
  clamped: boolean
  /** Inline error (install-specific when clamped past the end), or null. */
  error: string | null
  /** Inclusive day count; 0 when invalid. */
  span: number
  /** Hourly and longer than HOURLY_CONFIRM_DAYS. */
  largeHourly: boolean
}

/**
 * The request window. Daily/monthly start defaults to the install date (a
 * year back if unknown); hourly to the last 30 days, or the install date if
 * later. End defaults to `today` (YYYY-MM-DD, Denver, core/today; web/ used the browser's zone).
 */
export function dateWindow(o: {
  period: DlPeriod
  from: string | null
  to: string | null
  installDate: string | null
  today: string
}): DateWindow {
  const hourlyDefault = shiftDate(o.today, -(HOURLY_DEFAULT_DAYS - 1))
  const defaultStart =
    o.period === 'hourly'
      ? o.installDate && o.installDate > hourlyDefault
        ? o.installDate
        : hourlyDefault
      : (o.installDate ?? shiftDate(o.today, -365))
  const { start, clamped } = clampStart(o.from ?? defaultStart, o.installDate)
  const end = o.to ?? o.today
  const error = dateRangeError(start, end, clamped, o.installDate)
  const span = error ? 0 : daySpan(start, end)
  return { start, end, clamped, error, span, largeHourly: o.period === 'hourly' && span > HOURLY_CONFIRM_DAYS }
}

/** Warning under a large hourly range. */
export function largeHourlyText(span: number, needsConfirm: boolean): string {
  const n = (v: number) => v.toLocaleString('en-US')
  return `This hourly request spans ${n(span)} days (about ${n(span * 24)} rows per variable) and may be slow. ${
    needsConfirm ? 'Preview will ask you to confirm; or shorten the range.' : 'Click "Confirm large request" to fetch it.'
  }`
}

/** Same station/window/period → a confirmed large hourly request stays confirmed. */
export const confirmKey = (station: string | null, w: DateWindow, period: DlPeriod) =>
  `${station}|${w.start}|${w.end}|${period}`

/** Live-region text when a request lands. */
export function resultAnnouncement(rows: number, columns: number): string {
  if (rows === 0) return 'Request finished: no data for this selection.'
  return `Request finished: ${rows.toLocaleString('en-US')} ${rows === 1 ? 'row' : 'rows'}, ${columns} columns. Download CSV is ready.`
}

