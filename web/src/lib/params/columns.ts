/**
 * Column-name normalisation and pure column/depth helpers shared by the
 * charts. Mirrors params.lab_swap from the legacy app.
 */

/**
 * Column-name normalisation applied to API responses. Mirrors params.lab_swap.
 * The new API already emits `datetime` (legacy used `index`); the rename is
 * mostly soil depth conversions (cm → inches) and consolidating the multi-
 * height air-temp / wind columns under a single canonical label.
 */
export const LAB_SWAP: Record<string, string> = {
  index: 'datetime',
  'Air Temperature @ 2 m [°F]': 'Air Temperature [°F]',
  'Air Temperature @ 8 ft [°F]': 'Air Temperature [°F]',
  'Soil Temperature @ -10 cm [°F]': 'Soil Temperature @ 4 in [°F]',
  'Soil Temperature @ -70 cm [°F]': 'Soil Temperature @ 28 in [°F]',
  'Soil Temperature @ -100 cm [°F]': 'Soil Temperature @ 40 in [°F]',
  'Soil Temperature @ -20 cm [°F]': 'Soil Temperature @ 8 in [°F]',
  'Soil Temperature @ -5 cm [°F]': 'Soil Temperature @ 2 in [°F]',
  'Soil Temperature @ -50 cm [°F]': 'Soil Temperature @ 20 in [°F]',
  'Soil Temperature @ -91 cm [°F]': 'Soil Temperature @ 36 in [°F]',
  'Soil VWC @ -10 cm [%]': 'Soil VWC @ 4 in [%]',
  'Soil VWC @ -70 cm [%]': 'Soil VWC @ 28 in [%]',
  'Soil VWC @ -100 cm [%]': 'Soil VWC @ 40 in [%]',
  'Soil VWC @ -20 cm [%]': 'Soil VWC @ 8 in [%]',
  'Soil VWC @ -5 cm [%]': 'Soil VWC @ 2 in [%]',
  'Soil VWC @ -50 cm [%]': 'Soil VWC @ 20 in [%]',
  'Soil VWC @ -91 cm [%]': 'Soil VWC @ 36 in [%]',
  'Bulk EC @ -10 cm [mS/cm]': 'Bulk EC @ 4 in [mS/cm]',
  'Bulk EC @ -70 cm [mS/cm]': 'Bulk EC @ 28 in [mS/cm]',
  'Bulk EC @ -100 cm [mS/cm]': 'Bulk EC @ 40 in [mS/cm]',
  'Bulk EC @ -20 cm [mS/cm]': 'Bulk EC @ 8 in [mS/cm]',
  'Bulk EC @ -5 cm [mS/cm]': 'Bulk EC @ 2 in [mS/cm]',
  'Bulk EC @ -50 cm [mS/cm]': 'Bulk EC @ 20 in [mS/cm]',
  'Bulk EC @ -91 cm [mS/cm]': 'Bulk EC @ 36 in [mS/cm]',
  'Soil Water Potential @ -10 cm [bar]': 'Soil Water Potential @ 4 in [bar]',
  'Soil Water Potential @ -70 cm [bar]': 'Soil Water Potential @ 28 in [bar]',
  'Soil Water Potential @ -100 cm [bar]': 'Soil Water Potential @ 40 in [bar]',
  'Soil Water Potential @ -20 cm [bar]': 'Soil Water Potential @ 8 in [bar]',
  'Soil Water Potential @ -5 cm [bar]': 'Soil Water Potential @ 2 in [bar]',
  'Soil Water Potential @ -50 cm [bar]': 'Soil Water Potential @ 20 in [bar]',
  'Soil Water Potential @ -91 cm [bar]': 'Soil Water Potential @ 36 in [bar]',
  'Percent Saturation @ -10 cm [%]': 'Percent Saturation @ 4 in [%]',
  'Percent Saturation @ -70 cm [%]': 'Percent Saturation @ 28 in [%]',
  'Percent Saturation @ -100 cm [%]': 'Percent Saturation @ 40 in [%]',
  'Percent Saturation @ -20 cm [%]': 'Percent Saturation @ 8 in [%]',
  'Percent Saturation @ -5 cm [%]': 'Percent Saturation @ 2 in [%]',
  'Percent Saturation @ -50 cm [%]': 'Percent Saturation @ 20 in [%]',
  'Percent Saturation @ -91 cm [%]': 'Percent Saturation @ 36 in [%]',
  'Wind Direction @ 10 m [deg]': 'Wind Direction [deg]',
  'Wind Direction @ 8 ft [deg]': 'Wind Direction [deg]',
  'Wind Speed @ 10 m [mi/hr]': 'Wind Speed [mi/hr]',
  'Wind Speed @ 8 ft [mi/hr]': 'Wind Speed [mi/hr]',
  'Gust Speed @ 8 ft [mi/hr]': 'Gust Speed [mi/hr]',
  'Gust Speed @ 10 m [mi/hr]': 'Gust Speed [mi/hr]',
  'Wind Speed @ 10 m [mi/h]': 'Wind Speed [mi/hr]',
  'Wind Speed @ 8 ft [mi/h]': 'Wind Speed [mi/hr]',
  'Gust Speed @ 8 ft [mi/h]': 'Gust Speed [mi/hr]',
  'Gust Speed @ 10 m [mi/h]': 'Gust Speed [mi/hr]',
}

/* -------------------------------------------------------------------------- */
/* Column / depth helpers (pure). Consolidated from the chart components.     */
/* -------------------------------------------------------------------------- */

const isWindSpeed = (label: string) => /Wind Speed/.test(label)
const isPrecip = (label: string) => /Precipitation/.test(label)
const isReferenceEt = (label: string) => /Reference ET/.test(label)

/** Map a (LAB_SWAP-normalised) column header to the user-facing display variable. */
export function variableForColumn(col: string): string | null {
  if (col === 'Air Temperature [°F]') return 'Air Temperature'
  if (col === 'Atmospheric Pressure [mbar]') return 'Atmospheric Pressure'
  if (col === 'Relative Humidity [%]') return 'Relative Humidity'
  if (col === 'Solar Radiation [W/m²]') return 'Solar Radiation'
  if (col === 'Snow Depth [in]' || col === 'Snow Depth [in.]')
    return 'Snow Depth'
  if (col.startsWith('Soil Temperature')) return 'Soil Temperature'
  if (col.startsWith('Soil VWC')) return 'Soil VWC'
  if (col.startsWith('Bulk EC')) return 'Bulk EC'
  if (col.startsWith('Gust Speed')) return 'Gust Speed'
  if (isWindSpeed(col)) return 'Wind Speed'
  if (col.startsWith('Wind Direction')) return 'Wind Direction'
  if (col === 'Max Precip Rate [in/h]' || col === 'Max Precip Rate [in/hr]')
    return 'Max Precip Rate'
  if (isPrecip(col)) return 'Precipitation'
  if (isReferenceEt(col)) return 'Reference ET'
  if (col === 'Well Water Level [in]') return 'Well Water Level'
  if (col === 'Well Water Temperature [°F]') return 'Well Water Temperature'
  return null
}

/** Inches-only depth label: "Soil Temperature @ 4 in [°F]" → "4 in"; null if none. */
export function depthLabelFromColumn(col: string): string | null {
  const m = col.match(/@\s*([0-9]+\s*in)/)
  return m ? m[1].replace(/\s+/g, ' ') : null
}

/**
 * Depth label in either unit: "@ 2 in [bar]" → "2 in", "@ -5 cm [bar]" →
 * "-5 cm". Falls back to the column name itself when no depth is present.
 */
export function depthLabelFromCol(c: string): string {
  const m = c.match(/@\s*(-?\d+)\s*(cm|in)/)
  return m ? (m[2] === 'in' ? `${m[1]} in` : `${m[1]} cm`) : c
}

/**
 * Absolute numeric depth from a label ("-5 cm" → 5, "20 in" → 20); 0 when the
 * label has no number. Units are not converted, so only compare labels that
 * share a unit.
 */
export function depthInchesFromLabel(label: string): number {
  const m = label.match(/(-?\d+)/)
  return m ? Math.abs(parseInt(m[1], 10)) : 0
}

/** Sort key for depth labels (shallow → deep). Same as `depthInchesFromLabel`. */
export const depthOrder = depthInchesFromLabel

/**
 * Latest-tab variant of `variableForColumn` that also covers every element
 * the station element list can offer (legacy chips are built from
 * description_short, so e.g. VPD and Well EC must map too). Known columns map
 * as above; `Precipitation (fill-corrected)` (ppt_corrected) maps to nothing;
 * anything else falls back to the header text before "@" / "[", which is the
 * element's description_short, i.e. the chip name.
 */
export function latestVariableForColumn(col: string): string | null {
  if (col === 'station' || col === 'datetime' || col === 'provisional') return null
  if (/fill-corrected/i.test(col)) return null
  const known = variableForColumn(col)
  if (known) return known
  const name = col.split('@')[0].split('[')[0].trim()
  return name || null
}
