/**
 * `x-data="forecastCard"`: NWS forecast period cards for the station
 * (core/cards/forecast), rendered as text; on failure a degraded message,
 * a Retry button and the NWS page link.
 */
import Alpine from 'alpinejs'
import type { NwsForecast, Station } from '../../../core/api'
import type { Resource } from '../../../core/cache'
import { forecastDetailUrl, forecastHeading, forecastRows, type ForecastCardRow } from '../../../core/cards'
import { component } from '../../component'
import { nwsForecast } from '../../station/resources'

export function forecastCard() {
  return component({
    get station(): Station | undefined {
      return Alpine.store('station').current
    },

    get resource(): Resource<NwsForecast> | null {
      const s = this.station
      return s ? nwsForecast(s.latitude, s.longitude) : null
    },

    get rows(): ForecastCardRow[] {
      return forecastRows(this.resource?.data?.periods ?? [])
    },

    get state(): 'none' | 'loading' | 'error' | 'ready' {
      const r = this.resource
      if (!r) return 'none'
      if (r.status === 'loading' && !r.data) return 'loading'
      return this.rows.length ? 'ready' : 'error'
    },

    heading(): string {
      return forecastHeading(this.resource?.data, this.station?.name ?? '')
    },

    detailUrl(): string {
      const s = this.station
      return s ? forecastDetailUrl(s.latitude, s.longitude) : 'https://forecast.weather.gov/'
    },

    retry(): void {
      this.resource?.refresh()
    },
  })
}
