/**
 * Public surface of core/about: pure view models for the About section.
 *  - details:       station detail rows (name, id, network, coordinates, elevation, period of record)
 *  - sensorHistory: sensor installs and removals by day, from `/config/{station}/`
 *  - apiLinks:      API docs and this station's requests on the public API
 * The current-readings rows are core/cards/currentConditions.
 */
export * from './details'
export * from './sensorHistory'
export * from './apiLinks'
