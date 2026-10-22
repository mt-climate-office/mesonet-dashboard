/**
 * Station photos from the data2 archive (https://data2.climate.umt.edu/mesonet/photos/…), not the API.
 * The logic is the kit's `MCO.photos` (mco-web-style photos/mco-photos.js, pinned with SRI in
 * index.html, tested in the kit's tools/check-photos.mjs); this module only types it for the app.
 * Public rules come with it (website DECISIONS D7): North, East, South and West only, North first,
 * and nothing before the 2026-10-21 re-aim, so the first public day is 2026-10-22.
 *
 * Read at call time, never at import: the kit's classic scripts run before the app module, and the
 * unit tests evaluate the same pinned files into the global first (src/test/kit.ts).
 */
import type { McoPhotos, PhotoSchedule } from '../../types/mco-photos'

export type { PhotoFrame, PhotoSchedule, PhotoView, PhotoWindow, RawSchedule, StationCamera } from '../../types/mco-photos'

/** `MCO.photos`. */
export const photos = (): McoPhotos => MCO.photos

/** True when the station has a current public view (false while the schedule loads). */
export const hasCamera = (schedule: PhotoSchedule | undefined, station: string | null): boolean =>
  !!schedule && !!station && photos().hasCamera(schedule, station)
