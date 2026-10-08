/**
 * Public surface of core/about: pure view models for the About section.
 *  - details:       station detail rows (station + id, network, location, elevation, record)
 *  - readings:      every current reading and the precipitation summary, with plain labels
 *  - sensorHistory: sensor installs and removals by day, from `/config/{station}/`
 *  - apiLinks:      API docs and this station's requests on the public API
 *  - locator:       the locator map's camera frame (the station and its near neighbours)
 * The raw current-readings rows are core/cards/currentConditions.
 */
export * from './details'
export * from './sensorHistory'
export * from './apiLinks'
export * from './readings'
export * from './locator'
