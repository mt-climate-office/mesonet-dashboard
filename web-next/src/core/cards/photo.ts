/**
 * Latest Photo card view model over core/photos (web/ CameraCard logic):
 * which day, which source (latest listings vs. monthly manifest), which
 * direction chips and which frame. All times are America/Denver.
 */
import {
  addDays,
  basename,
  directionLabel,
  formatLocal,
  framesFor,
  localToUtcMs,
  localYmd,
  tokensOf,
  viewsBetween,
  type PhotoFrame,
  type StationCamera,
} from '../photos'

/**
 * The day shown: the user's pick, else the local day of the newest latest
 * frame, else today (`YYYY-MM-DD`).
 */
export function photoDay(picked: string | null, latest: readonly PhotoFrame[] | undefined, today: string): string {
  if (picked) return picked
  let newest: number | null = null
  for (const f of latest ?? []) if (newest == null || f.slotUtcMs > newest) newest = f.slotUtcMs
  return newest != null ? localYmd(newest) : today
}

/**
 * Today and yesterday come from the latest listings (three UTC days span both
 * local days at any hour); older days from the station's monthly manifest.
 */
export const isRecentDay = (day: string, today: string): boolean => day >= addDays(today, -1)

/** Earliest pickable day: the 1st of the camera's first archived month, or null. */
export const photoMinDay = (cam: StationCamera): string | null => (cam.firstMonth ? `${cam.firstMonth}-01` : null)

/** True when the schedule lists no views for the station, ever. */
export const noCameraImages = (cam: StationCamera | undefined): boolean =>
  !cam || (cam.currentViews.length === 0 && cam.periods.length === 0)

/**
 * Cache-key suffix for confirming a day's derived frames (manifest
 * `webp_large` blank): their basenames, sorted; '' when none need confirming.
 */
export function derivedKey(frames: readonly PhotoFrame[]): string {
  return frames
    .filter((f) => f.derived)
    .map((f) => basename(f.webpUrl))
    .sort()
    .join(',')
}

export interface PhotoPick {
  /** Direction chips (tokens), canonical order. */
  tokens: string[]
  /** token → chip label (legacy words). */
  labels: Record<string, string>
  /** The chosen direction: the pick if offered, else N, else the first. */
  direction: string
  /** That direction's frames on the day, newest first (the time options). */
  frames: PhotoFrame[]
  /** The chosen frame: the picked slot if present, else the newest; undefined = none that day. */
  active: PhotoFrame | undefined
  /** "acebozem North camera Oct 1, 2026 3:00 PM" ('' stamp without a frame). */
  alt: string
  stamp: string
}

export interface PhotoPickInput {
  station: string
  cam: StationCamera
  day: string
  recent: boolean
  /** Frames from the day's source (latest listings or the confirmed manifest day); undefined while loading. */
  frames: readonly PhotoFrame[] | undefined
  direction: string | null
  slotUtcMs: number | null
}

/**
 * Chips are the directions that have frames that day; with none (loading or
 * an empty day), the views the schedule had on that day.
 */
export function photoPick(i: PhotoPickInput): PhotoPick {
  const dayFrames = framesFor([...(i.frames ?? [])], i.day)
  const tokens = dayFrames.length
    ? tokensOf(dayFrames)
    : (i.recent
        ? i.cam.currentViews
        : viewsBetween(i.cam, localToUtcMs(i.day), localToUtcMs(addDays(i.day, 1)))
      ).map((v) => v.token)
  const labels = Object.fromEntries(tokens.map((t) => [t, i.cam.allLabels[t] ?? directionLabel(t)]))
  const direction =
    i.direction && tokens.includes(i.direction) ? i.direction : tokens.includes('N') ? 'N' : (tokens[0] ?? 'N')
  const frames = dayFrames.filter((f) => f.token === direction)
  const active = frames.find((f) => f.slotUtcMs === i.slotUtcMs) ?? frames[0]
  const stamp = active ? formatLocal(active.slotUtcMs) : ''
  const label = labels[direction] ?? directionLabel(direction)
  return { tokens, labels, direction, frames, active, stamp, alt: `${i.station} ${label} camera ${stamp}`.trim() }
}

/** Time-select options for a direction's frames: value = slot ms, label = local time. */
export const photoTimeOptions = (frames: readonly PhotoFrame[]): { value: string; label: string }[] =>
  frames.map((f) => ({ value: String(f.slotUtcMs), label: formatLocal(f.slotUtcMs) }))
