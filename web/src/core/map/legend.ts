/**
 * Station-map legend model: the one station marker (no network rows: networks are not encoded,
 * HOUSE-STYLE §7), a co-located row with the count badge and how many sites carry one, and the
 * selection ring. Text carries the meaning; swatches are decoration.
 */
import { NETWORK_COLOR, SELECTION_RING, resolve, type Theme } from '../palette'
import type { MarkerCollection } from './markers'

/** Reads a kit CSS variable (the UI passes a getComputedStyle reader). */
export type GetVar = (name: string) => string

export interface MarkerStyle {
  fill: string
  stroke: string
  /** Stroke width in px. */
  strokeWidth: number
}

/** The count badge drawn on a swatch: `MCO.map.colocation.badgeLayers`' colors. */
export interface LegendBadge {
  text: string
  fill: string
  stroke: string
  color: string
}

export interface LegendRow {
  key: string
  label: string
  /** Co-located sites drawn (that row only); null elsewhere. */
  count: number | null
  swatch: MarkerStyle
  /** The count badge on the swatch (the co-located row); null elsewhere. */
  badge: LegendBadge | null
}

/** `MCO.map.stationPaint()`'s defaults: the HydroMet blue with a --dot-stroke edge, the same in every theme. */
export function stationStyle(theme: Theme, getVar: GetVar): MarkerStyle {
  return { fill: NETWORK_COLOR[theme].HydroMet, stroke: resolve({ token: '--dot-stroke' }, getVar), strokeWidth: 1.2 }
}

/** Legend rows for the features currently drawn (`MCO.map.colocation`'s collection). */
export function legendRows(markers: MarkerCollection, theme: Theme, getVar: GetVar): LegendRow[] {
  const station = stationStyle(theme, getVar)
  const stacked = markers.features.filter((f) => f.properties.colocationIndex === 0 && f.properties.colocationCount > 1)
  const rows: LegendRow[] = []
  if (markers.features.length) rows.push({ key: 'station', label: 'Station', count: null, swatch: station, badge: null })
  if (stacked.length) {
    rows.push({
      key: 'co-located',
      label: 'Co-located stations',
      count: stacked.length,
      swatch: station,
      badge: {
        text: String(Math.max(...stacked.map((f) => f.properties.colocationCount))),
        fill: resolve({ token: '--accent' }, getVar),
        stroke: resolve({ token: '--dot-stroke' }, getVar),
        color: resolve({ token: '--text-on-accent' }, getVar),
      },
    })
  }
  rows.push({
    key: 'selected',
    label: 'Selected station',
    count: null,
    swatch: { fill: 'rgba(0,0,0,0)', stroke: resolve(SELECTION_RING, getVar), strokeWidth: 2.5 },
    badge: null,
  })
  return rows
}
