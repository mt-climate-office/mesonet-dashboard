/**
 * Barrel for the API client; `import … from '../lib/api'` resolves here.
 *  - http:    HttpError, buildUrl, fetchText/fetchJson/fetchCsv, mergeOn
 *  - types:   API row/response shapes
 *  - meta:    stations, elements, latest, config, ppt summary
 *  - record:  getStationRecord (+ fmtDate, exclusiveEnd)
 *  - photos:  camera catalog
 *  - derived: Ag Tools /derived + soil fetchers
 */
export * from './http'
export * from './types'
export * from './meta'
export * from './record'
export * from './photos'
export * from './derived'
