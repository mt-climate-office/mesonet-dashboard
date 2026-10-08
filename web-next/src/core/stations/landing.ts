/**
 * The no-station landing (partials/landing.html, ui/picker/stationLanding.ts): when it shows
 * in place of the sections, and its text. Pure; read through `$store.station.landing`.
 */

/**
 * Show the landing? `param` is `?s=`, `catalog` the station list's status, `confirmed` the
 * catalog-confirmed id. Yes with no `?s=` (a first visit, the list loading or not), and for a
 * `?s=` the loaded list does not know. No once a station is confirmed, while a linked station
 * waits for the list, or when the list failed (the sections show its error and Retry).
 */
export function showsLanding(
  param: string | null,
  catalog: 'loading' | 'success' | 'error' | undefined,
  confirmed: string | null,
): boolean {
  if (confirmed || catalog === 'error') return false
  return !param || catalog === 'success'
}

/** The line under the heading: "… from 128 Montana Mesonet stations." (no count until the list loads). */
export function landingLine(count: number): string {
  return `Current conditions, trends and forecasts from ${count > 0 ? `${count} ` : ''}Montana Mesonet stations.`
}

/** The note for a `?s=` the list does not know ("" without one). */
export function unknownStationNote(param: string | null): string {
  return param ? `There is no station “${param}”. Choose another below.` : ''
}
