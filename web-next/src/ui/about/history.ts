/**
 * `x-data="aboutHistory"` (partials/sheets/about-history.html): sensor
 * installs and removals by day (core/about `sensorHistory`) from
 * `/config/{station}/`, the cached response Compare's sensor overlays also
 * read. `sensorChanges(id)` also gives About's row its latest date.
 */
import Alpine from 'alpinejs'
import { sensorHistory, type SensorChangeDay } from '../../core/about'
import type { RawInstrument } from '../../core/sensorEvents'
import { component } from '../component'
import { stationConfig } from '../station/resources'

/** Station `id`'s sensor changes by day, newest first; [] until the config answers. */
export function sensorChanges(id: string | null): SensorChangeDay[] {
  const cfg = id ? stationConfig(id).data : undefined
  return cfg ? sensorHistory(Alpine.raw(cfg).instruments as unknown as RawInstrument[] | undefined) : []
}

export function aboutHistory() {
  return component({
    get state(): 'loading' | 'error' | 'empty' | 'ready' {
      const id = Alpine.store('station').id
      if (!id) return 'loading'
      const r = stationConfig(id)
      if (r.status === 'loading' && !r.data) return 'loading'
      if (r.status === 'error' && !r.data) return 'error'
      return this.days.length ? 'ready' : 'empty'
    },

    get days(): SensorChangeDay[] {
      return sensorChanges(Alpine.store('station').id)
    },
  })
}
