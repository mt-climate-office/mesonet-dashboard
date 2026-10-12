/**
 * Barrel for app constants; `import … from '../params'` resolves here.
 * Sections:
 *  - endpoints: AggPeriod, ENDPOINTS, DERIVED_ENDPOINTS
 *  - latest:    Latest-tab variables/colors/axes, wind helpers, SUM_AGGREGATED
 *  - columns:   LAB_SWAP + pure column/depth helpers
 *  - ag:        Ag Tools options and GDD thresholds
 *  - palettes:  CVD-safe palettes and derived color maps
 *  - satellite: Satellite tab constants
 */
export * from './endpoints'
export * from './latest'
export * from './columns'
export * from './ag'
export * from './palettes'
export * from './satellite'
