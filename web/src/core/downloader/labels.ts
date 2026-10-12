/**
 * Element-picker labels: the API's `description_short` in plain words
 * (core/variables/labels) with metric sensor depths/heights in US units, like
 * legacy `params.dist_swap` ("Soil VWC @ -10 cm" → "Soil moisture at 4 in",
 * "Air Temperature @ 2 m" → "Air temperature at 6.6 ft"). Legacy lacked
 * -70 cm; added. Only the label changes: the element code stays the value, and
 * CSV headers and filenames stay exactly as the API sends.
 */
import { ELEM_MAP, latestVarName } from '../params/latest'
import { plainName } from '../variables/labels'

const DIST_SWAP: Readonly<Record<string, string>> = {
  '-5 cm': '2 in',
  '-10 cm': '4 in',
  '-20 cm': '8 in',
  '-50 cm': '20 in',
  '-70 cm': '28 in',
  '-91 cm': '36 in',
  '-100 cm': '40 in',
  '10 m': '33 ft',
  '2 m': '6.6 ft',
}

/** The plain name of an element's `description_short`, without its height or depth ("Air temperature"). */
export function elementName(descriptionShort: string): string {
  const api = latestVarName(descriptionShort)
  return plainName(ELEM_MAP[api]?.[0] ?? '', api)
}

/** The picker label for an element's `description_short` (see the header); unknown names keep the API's. */
export function elementLabel(descriptionShort: string): string {
  const name = elementName(descriptionShort)
  const at = /@\s*(.+)$/.exec(descriptionShort)?.[1].trim()
  return at ? `${name} at ${at.replace(/(-?\d+ (?:cm|m))(?![\w/])/g, (m) => DIST_SWAP[m] ?? m)}` : name
}
