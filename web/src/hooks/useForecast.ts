import { useQuery } from '@tanstack/react-query'

export interface ForecastPeriod {
  number: number
  name: string
  startTime: string
  endTime: string
  isDaytime: boolean
  temperature: number
  temperatureUnit: string
  windSpeed: string
  windDirection: string
  icon: string
  shortForecast: string
  detailedForecast: string
  probabilityOfPrecipitation?: { value: number | null; unitCode: string }
}

interface PointsResponse {
  properties?: { forecast?: string; relativeLocation?: { properties?: { city?: string; state?: string } } }
}

interface ForecastResponse {
  properties?: { periods?: ForecastPeriod[] }
}

/**
 * NWS forecast for a lat/lon. The API is two-step: first hit /points/{lat},{lon}
 * to discover the forecast endpoint URL, then fetch that. Both responses
 * include long Cache-Control headers so we lean on TanStack's staleTime to
 * avoid re-querying within a half hour.
 */
export function useForecast(latitude: number | null, longitude: number | null) {
  return useQuery({
    queryKey: ['nws-forecast', latitude, longitude],
    enabled: latitude != null && longitude != null,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const points = await fetch(
        `https://api.weather.gov/points/${latitude},${longitude}`,
        { headers: { Accept: 'application/geo+json' } },
      )
      if (!points.ok) {
        throw new Error(`NWS /points returned ${points.status}`)
      }
      const pointsBody = (await points.json()) as PointsResponse
      const forecastUrl = pointsBody.properties?.forecast
      if (!forecastUrl) throw new Error('NWS /points response missing forecast URL')

      const fc = await fetch(forecastUrl, {
        headers: { Accept: 'application/geo+json' },
      })
      if (!fc.ok) {
        throw new Error(`NWS forecast returned ${fc.status}`)
      }
      const fcBody = (await fc.json()) as ForecastResponse
      const periods = fcBody.properties?.periods ?? []
      const location = pointsBody.properties?.relativeLocation?.properties
      return {
        location:
          location?.city && location?.state ? `${location.city}, ${location.state}` : null,
        periods,
      }
    },
  })
}
