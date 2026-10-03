/**
 * Barrel for the Now overview models:
 *  - tiles:      buildOverview (header freshness, hero, tiles) — the entry point
 *  - conditions: readConditions, feelsLikeF (NWS)
 *  - series:     sparkSeries, todayHighLow, hourlyPrecip, SPARK_ELEMENTS
 *  - precip:     precipSummary
 *  - normals:    normalMedianOn, ytdNormal
 *  - stamp:      stampEpochMs, updatedText, isStale
 *  - snow:       hasSnow (when the snow depth tile shows)
 *  - summary:    summarize (the hero's one-line summary) and its phrase rules
 */
export * from './tiles'
export * from './conditions'
export * from './series'
export * from './precip'
export * from './normals'
export * from './stamp'
export * from './snow'
export * from './summary'
