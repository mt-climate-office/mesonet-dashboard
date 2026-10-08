/**
 * `x-data="aboutReadings"` (partials/sheets/about-readings.html): every
 * current reading from `/latest` with plain labels (core/about `readingRows`),
 * plus the precipitation summary from `/derived/ppt/` for HydroMet stations
 * only (it 422s for AgriMet). `currentReadings(id)` also gives About's row its count.
 */
import Alpine from 'alpinejs'
import { pptRows, readingRows, type Reading } from '../../core/about'
import { loadErrorText } from '../../core/loadError'
import { component } from '../component'
import { latestObs, pptSummary } from '../station/resources'
import { initScrollFade } from '../layout/scrollFade'

/** Station `id`'s current readings, Observed first; [] until `/latest` answers. */
export function currentReadings(id: string | null): Reading[] {
  const first = id ? latestObs(id).data?.[0] : undefined
  return first ? readingRows(first as Record<string, unknown>) : []
}

export function aboutReadings() {
  let unhint: (() => void) | null = null
  return component({
    /** `x-init` on the scroll region: fade its bottom while there is more (ui/layout/scrollFade). */
    hint(el: HTMLElement): void {
      unhint?.()
      unhint = initScrollFade(el)
    },

    /** The error state's text (partials/load-error.html); '' unless the request failed. */
    loadError(): string {
      const id = Alpine.store('station').id
      const r = id ? latestObs(id) : null
      return r?.status === 'error' ? loadErrorText('Current readings', r.error) : ''
    },
    get state(): 'loading' | 'error' | 'empty' | 'ready' {
      const id = Alpine.store('station').id
      if (!id) return 'loading'
      const r = latestObs(id)
      if (r.status === 'loading' && !r.data) return 'loading'
      if (r.status === 'error' && !r.data) return 'error'
      return this.rows.length ? 'ready' : 'empty'
    },

    get rows(): Reading[] {
      return currentReadings(Alpine.store('station').id)
    },

    get pptRows(): Reading[] {
      const s = Alpine.store('station').current
      if (s?.sub_network !== 'HydroMet') return []
      return pptRows(pptSummary(s.station).data?.[0])
    },

    destroy() {
      unhint?.()
    },
  })
}
