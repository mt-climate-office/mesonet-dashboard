/**
 * The NWS forecast page link under the Now hero's 48 h strip ("Full
 * forecast"). The strip itself is core/charts/heroStrip.ts.
 */

/** NWS point-forecast page (decimal degrees). */
export const forecastDetailUrl = (lat: number, lon: number): string =>
  `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`
