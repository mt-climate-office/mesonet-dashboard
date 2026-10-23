/**
 * Station photos from the data2 archive (https://data2.climate.umt.edu/mesonet/photos/…), not the API.
 * The logic is the kit's `MCO.photos` (mco-web-style photos/mco-photos.js, pinned with SRI in
 * index.html, tested in the kit's tools/check-photos.mjs); this module only types it for the app.
 * Public rules come with it: North, East, South and West only, North first. The dashboard asks for
 * the full public history (`fullHistory: true`, website DECISIONS D16), so the 2026-10-22 floor the
 * website hero uses (D7) does not apply here.
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
