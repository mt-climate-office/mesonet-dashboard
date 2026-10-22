/**
 * Element-picker labels: the API's `description_short` in plain words
 * (core/variables/labels) with its sensor depth or height kept metric, as the
 * API names it ("Soil VWC @ -10 cm" → "Soil moisture at 10 cm", "Air
 * Temperature @ 2 m" → "Air temperature at 2 m"): heights and depths are not
 * display units (core/units). Only the label changes: the element code stays
 * the value, and CSV headers and filenames stay exactly as the API sends.
 */
import { ELEM_MAP, latestVarName } from '../params/latest'
import { plainName } from '../variables/labels'

/** The plain name of an element's `description_short`, without its height or depth ("Air temperature"). */
export function elementName(descriptionShort: string): string {
  const api = latestVarName(descriptionShort)
  return plainName(ELEM_MAP[api]?.[0] ?? '', api)
}

/** The picker label for an element's `description_short` (see the header); unknown names keep the API's. */
export function elementLabel(descriptionShort: string): string {
  const name = elementName(descriptionShort)
  const at = /@\s*(.+)$/.exec(descriptionShort)?.[1].trim()
  // A depth drops its minus sign ("-10 cm" → "10 cm").
  return at ? `${name} at ${at.replace(/-(\d+ cm)\b/g, '$1')}` : name
}
