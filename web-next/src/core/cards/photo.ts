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
  formatLocalTime,
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

/** Label of a direction: the schedule's (legacy) label, else the legacy word, else the token. */
export const photoLabel = (cam: StationCamera, token: string): string => cam.allLabels[token] ?? directionLabel(token)

/**
 * What a past day shows while its derived WebPs are unconfirmed, or when the
 * confirmation failed: the manifest frames that name their WebP.
 */
export const knownFrames = (frames: readonly PhotoFrame[]): PhotoFrame[] => frames.filter((f) => !f.derived)

export interface PhotoPick {
  /** Direction chips (tokens), canonical order. */
  tokens: string[]
  /** token → chip label (legacy words). */
  labels: Record<string, string>
  /** The chosen direction: the pick if offered, else N, else the first. */
  direction: string
  /** Its label (defined even when no chip is offered, e.g. a day before the camera). */
  label: string
  /** That direction's frames on the day, newest first (the time options). */
  frames: PhotoFrame[]
  /** The chosen frame: the picked slot if present, else the newest; undefined = none that day. */
  active: PhotoFrame | undefined
  /** "Bozeman North camera Oct 1, 2026 3:00 PM" ('' stamp without a frame). */
  alt: string
  stamp: string
}

export interface PhotoPickInput {
  /** The station's display name ("Bozeman"; its id while the catalog loads), for the alt text. */
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
  const labels = Object.fromEntries(tokens.map((t) => [t, photoLabel(i.cam, t)]))
  const direction =
    i.direction && tokens.includes(i.direction) ? i.direction : tokens.includes('N') ? 'N' : (tokens[0] ?? 'N')
  const frames = dayFrames.filter((f) => f.token === direction)
  const active = frames.find((f) => f.slotUtcMs === i.slotUtcMs) ?? frames[0]
  const stamp = active ? formatLocal(active.slotUtcMs) : ''
  const label = photoLabel(i.cam, direction)
  return { tokens, labels, direction, label, frames, active, stamp, alt: `${i.station} ${label} camera ${stamp}`.trim() }
}

/**
 * Now's photo carousel: the newest frame of every direction that has one, the default direction
 * (photoPick's: N, else the first) first, then the rest in canonical order. `direction` and
 * `slotUtcMs` in the input are ignored.
 */
export function photoSlides(i: PhotoPickInput): PhotoPick[] {
  const first = photoPick({ ...i, direction: null, slotUtcMs: null })
  const order = [first.direction, ...first.tokens.filter((t) => t !== first.direction)]
  return order.map((t) => (t === first.direction ? first : photoPick({ ...i, direction: t, slotUtcMs: null }))).filter((p) => p.active)
}

/** Time-select options for a direction's frames: value = slot ms, label = local time only ("3:00 PM";
 *  the Day field beside it holds the date). */
export const photoTimeOptions = (frames: readonly PhotoFrame[]): { value: string; label: string }[] =>
  frames.map((f) => ({ value: String(f.slotUtcMs), label: formatLocalTime(f.slotUtcMs) }))

/** The photo dialog's title: "Bozeman · North · Oct 1, 2026 3:00 PM" ('' without a pick). */
export const photoTitle = (name: string, p: PhotoPick | null): string =>
  p ? [name, p.label, p.stamp].filter(Boolean).join(' · ') : ''

type Status = 'loading' | 'success' | 'error'

/** Inputs of a photo view's state: the schedule's fetch status, the camera, the day's source and its pick. */
export interface PhotoStateInput {
  schedule: Status
  cam: StationCamera | undefined
  /** The day's frames; null when the camera has no source for it. */
  source: { status: Status; data: readonly PhotoFrame[] | undefined } | null
  pick: PhotoPick | null
}

/** 'loading' (skeleton), 'message' (photoMessage) or 'ready' (pick.active is set). */
export function photoState(i: PhotoStateInput): 'loading' | 'message' | 'ready' {
  if (i.schedule === 'loading') return 'loading'
  if (i.schedule === 'error' || noCameraImages(i.cam)) return 'message'
  if (!i.source || (i.source.status === 'loading' && !i.source.data)) return 'loading'
  return i.pick?.active ? 'ready' : 'message'
}

/** The text shown for photoState 'message'. */
export function photoMessage(i: PhotoStateInput): string {
  if (i.schedule === 'error') return 'Camera schedule unavailable.'
  if (noCameraImages(i.cam)) return 'No camera images are available for this station.'
  if (i.source?.status === 'error') return 'Camera images could not be loaded.'
  return `No camera images are available for ${i.pick ? i.pick.label : 'this view'} on this date.`
}
