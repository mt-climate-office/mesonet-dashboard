/**
 * `x-data="customDates"`: the Custom dates sheet's form (partials/sheets/dates.html,
 * opened from a variable page's ⋯ menu). The `dateRange` control over the
 * chart window (`from`/`to`; install date … today); a valid pick applies at
 * once (leaving All years; 5-min drops past 7 days) and Done closes the sheet.
 */
import Alpine from 'alpinejs'
import { installDate, todayIso } from '../../core/latest'
import { chartWindow, isIsoDate } from '../../core/models/timeseries'
import { windowPatch } from '../../core/variables'
import { component } from '../component'
import { closeSheet } from '../shell/sheet'

const url = () => Alpine.store('url')

export function customDates() {
  return component({
    dates() {
      const w = chartWindow(url().state.from, url().state.to)
      return { start: isIsoDate(w.start) ? w.start : '', end: isIsoDate(w.end) ? w.end : '' }
    },
    minDate: (): string | null => installDate(Alpine.store('station').current),
    maxDate: (): string => todayIso(),
    setDates(r: { start: string; end: string }): void {
      url().set(windowPatch(r.start, r.end, url().state.agg))
    },
    done: (): void => closeSheet('dates'),
  })
}
