/**
 * `x-data="chartWall"` (partials/now/wall.html): Now's chart wall on wide screens (core/overview
 * wall). One request for every wall variable over the last 7 days, sliced into one small chart per
 * variable; each card opens that variable's page on the same window. About's details and map follow.
 */
import Alpine from 'alpinejs'
import { variableTable, variableWallChart, type LatestTimeseriesModel } from '../../core/charts'
import { loadErrorText } from '../../core/loadError'
import { WALL_RANGE, wallPanel, wallVariables, wallWindow } from '../../core/overview'
import { chartPatch, plainName, rangeChipPatch, type Variable } from '../../core/variables'
import type { UrlState } from '../../core/url-schema'
import type { ChartBindings } from '../charts/chart'
import { chartVariables, recordResource, seriesModel, seriesRequest, type SeriesQuery } from '../charts/resources'
import { component } from '../component'
import { follow } from '../shell/navigate'

const stations = () => Alpine.store('station')

/** A card's link: its variable page on the wall's window (the 7 d chip). */
const patchFor = (v: Variable): Partial<UrlState> => ({ ...chartPatch(v.id), ...rangeChipPatch(WALL_RANGE, null) })

export function chartWall() {
  const build = seriesModel()
  // Each card's slice, kept while the shared model is the same object (a new one would redraw the chart).
  const slices = new Map<string, { base: LatestTimeseriesModel; model: LatestTimeseriesModel | null }>()
  return component({
    get variables(): Variable[] {
      return wallVariables(chartVariables(stations().id) ?? [])
    },
    query(): SeriesQuery | null {
      const id = stations().id
      const vars = this.variables
      if (!id || !vars.length) return null
      const { agg, ...window } = wallWindow()
      return { station: id, window, agg, vars: vars.map((v) => v.name), gridmet: false }
    },
    model(): LatestTimeseriesModel | null {
      const q = this.query()
      return q ? build(q) : null
    },
    /** The cards' skeletons show until the shared request has drawn something (or failed). */
    loading(): boolean {
      const q = this.query()
      return !this.model() && !!q && recordResource(seriesRequest(q))?.status !== 'error'
    },
    /** The error state's text (partials/load-error.html); '' unless the wall's request failed with nothing to show. */
    loadError(): string {
      const q = this.query()
      const rec = q ? recordResource(seriesRequest(q)) : null
      return rec?.status === 'error' && !this.model() ? loadErrorText('These charts', rec.error) : ''
    },
    name: (v: Variable): string => plainName(v.id, v.name),

    /** Bindings for a card's nested `x-data="chart(cardChart(v))"`. */
    cardChart(v: Variable): ChartBindings<LatestTimeseriesModel> {
      return {
        builder: variableWallChart,
        table: variableTable,
        label: `${plainName(v.id, v.name)}, the last 7 days`,
        model: () => {
          const base = this.model()
          if (!base) return null
          const hit = slices.get(v.name)
          if (hit?.base === base) return hit.model
          const model = wallPanel(base, v.name)
          slices.set(v.name, { base, model })
          return model
        },
      }
    },
    cardHref(v: Variable): string {
      return Alpine.store('url').hrefFor('charts', patchFor(v))
    },
    /** A card: push its variable page (Back returns to Now); the page heading takes focus. */
    openCard(e: MouseEvent, v: Variable): void {
      follow(e, 'charts', { patch: patchFor(v), target: 'var-title', from: 'now' })
    },
  })
}
