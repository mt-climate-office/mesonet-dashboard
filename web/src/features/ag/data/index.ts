/**
 * Ag Tools data layer (workstream B). Contract shapes in, contract shapes out;
 * see `../contract.ts`.
 *  - observations: DailyMet / HourlyMet / SoilSeries / StationMeta adapters
 *  - soilParams:   SoilParams (data2 → vendored)
 *  - gddStages:    GddStageTable per crop (data2 → vendored)
 *  - normals:      gridMET DailyNormals (SI)
 *  - forecast:     NWS gridpoint ForecastDaily (degraded instead of throwing)
 *  - annual:       multi-year daily series for the Annual comparison
 *  - hooks:        TanStack Query wrappers
 */
export * from './observations'
export * from './soilParams'
export * from './gddStages'
export * from './normals'
export * from './forecast'
export * from './annual'
export * from './hooks'
export { type StaticSource, DATA2_BASE } from './staticSource'
