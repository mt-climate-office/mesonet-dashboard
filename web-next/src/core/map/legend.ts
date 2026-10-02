/**
 * Station-map legend model: one row per network present (swatch paint +
 * text label), a co-located row (with a count) when any marker merges stations, and
 * the selection ring. Text carries the meaning; swatches are decoration.
 */
import { SELECTION_RING, resolve, type Theme } from '../palette'
import { markerStyle, type GetVar, type MarkerCollection, type MarkerFeature, type MarkerStyle, keyCodes } from './markers'

export interface LegendRow {
  key: string
  label: string
  /** Co-located markers drawn (that row only); null elsewhere. */
  count: number | null
  swatch: MarkerStyle
  /** Outer ring color drawn around the swatch ('' for none). */
  halo: string
}

/** Legend rows for the markers currently drawn. */
export function legendRows(markers: MarkerCollection, theme: Theme, getVar: GetVar): LegendRow[] {
  const nets = new Set<string>()
  let coLocated: MarkerFeature | undefined
  let coLocatedCount = 0
  for (const f of markers.features) {
    for (const n of f.properties.networks.split(',')) nets.add(n)
    if (keyCodes(f.properties.key).length > 1) {
      coLocated ??= f
      coLocatedCount += 1
    }
  }
  const rows: LegendRow[] = (['HydroMet', 'AgriMet', 'Cooperator'] as const)
    .filter((net) => nets.has(net))
    .map((net) => ({ key: net, label: net, count: null, swatch: markerStyle(net, theme, getVar), halo: '' }))
  if (coLocated) {
    const p = coLocated.properties
    rows.push({
      key: 'co-located',
      label: 'Co-located stations',
      count: coLocatedCount,
      swatch: { fill: p.fill, stroke: p.stroke, strokeWidth: p.strokeWidth },
      halo: p.halo,
    })
  }
  rows.push({
    key: 'selected',
    label: 'Selected station',
    count: null,
    swatch: { fill: 'rgba(0,0,0,0)', stroke: resolve(SELECTION_RING, getVar), strokeWidth: 2.5 },
    halo: '',
  })
  return rows
}
