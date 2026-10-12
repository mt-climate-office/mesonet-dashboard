/**
 * The document title (GS-007): HOUSE-STYLE §1 `<Short name> · <Family>`, with
 * the selected station's name first so it survives tab-bar truncation.
 * ui/shell/navMeta.ts keeps `document.title` in sync with the station.
 */

/** The static title, as in index.html `<title>`. */
export const BASE_TITLE = 'Dashboard · MT Mesonet'

/** "Bozeman · Dashboard · MT Mesonet" with a station, else the base title. */
export function pageTitle(stationName: string | null | undefined): string {
  const name = stationName?.trim()
  return name ? `${name} · ${BASE_TITLE}` : BASE_TITLE
}
