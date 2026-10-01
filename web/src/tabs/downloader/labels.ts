/**
 * Element-picker labels: the API's `description_short` with metric sensor
 * depths/heights shown in US units, like legacy `params.dist_swap`
 * ("Soil VWC @ -10 cm" → "Soil VWC @ 4 in"). Legacy lacked -70 cm; added.
 * Only the picker label changes; CSV headers stay exactly as the API sends.
 */
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

export function elementLabel(descriptionShort: string): string {
  return descriptionShort.replace(/(-?\d+ (?:cm|m))(?![\w/])/g, (m) => DIST_SWAP[m] ?? m)
}
