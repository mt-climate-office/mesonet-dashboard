/**
 * The header's station button text (ui/shell/stationHeader.ts): the station's
 * name, a pending blank while a `?s=` link resolves, or the call to choose one.
 */

export const CHOOSE_STATION = 'Choose a station'

/**
 * `name` is the selected station's name (undefined until the catalog confirms it); `linked` is
 * true when the URL names a station; `loading` while the catalog has not settled. Returns '' while
 * a linked station is still loading (the header draws a name-sized skeleton, never "Choose a station").
 */
export function headerName(name: string | undefined, linked: boolean, loading: boolean): string {
  if (name) return name
  return linked && loading ? '' : CHOOSE_STATION
}
