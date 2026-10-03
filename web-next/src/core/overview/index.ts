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
 *  - relevance:  nowTiles (the tiles Now shows), pressure trend, dew point, soil state
 *  - hero:       buildHero (the Now hero: temperature, summary, 48 h strip model)
 *  - nowPage:    buildNowPage (the whole Now page: hero, tile views, row metas), the SWP chip request
 *  - rainBars:   rainDailyQuery, rainBars (the Rain tile: 7 daily bars, or nothing in a dry week)
 */
export * from './tiles'
export * from './conditions'
export * from './series'
export * from './precip'
export * from './normals'
export * from './stamp'
export * from './snow'
export * from './summary'
export * from './relevance'
export * from './hero'
export * from './nowPage'
export * from './rainBars'
