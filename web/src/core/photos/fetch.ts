/**
 * Fetchers for the data2 photo archive (CORS-open CDN). A 404 means "nothing
 * there" and resolves to null, not an error.
 */
import { framesFromListing, parseManifest, patternPrefix, type PhotoFrame } from './archive'
import { PHOTO_BASE, parseSchedule, type PhotoSchedule, type RawSchedule, type StationCamera } from './schedule'
import { utcYmd } from './time'

const DAY_MS = 86_400_000

export async function fetchArchiveText(url: string, timeoutMs = 20_000): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`photo archive HTTP ${res.status}: ${url}`)
  return res.text()
}

export async function fetchSchedule(base = PHOTO_BASE): Promise<PhotoSchedule> {
  const text = await fetchArchiveText(`${base.replace(/\/+$/, '')}/photos/schedule/schedule.json`)
  if (text == null) throw new Error('photo schedule not found')
  return parseSchedule(JSON.parse(text) as RawSchedule)
}

/**
 * One UTC day of WebP frames for one direction via S3 ListObjectsV2 through
 * the CDN. Only `prefix` is forwarded (no max-keys/start-after), hence one
 * day per request.
 */
export async function listDay(
  schedule: PhotoSchedule,
  cam: StationCamera,
  token: string,
  ymdUtc: string,
): Promise<PhotoFrame[]> {
  const prefix = patternPrefix(schedule.patterns.webp_large, cam.station, token) + ymdUtc
  const url = `${schedule.base.replace(/\/+$/, '')}/?list-type=2&prefix=${encodeURIComponent(prefix)}`
  const xml = await fetchArchiveText(url)
  return framesFromListing(xml ?? '', cam.station, token, {
    base: schedule.base,
    patterns: schedule.patterns,
    labels: cam.allLabels,
  })
}

/**
 * Latest frames for every current direction, covering local (America/Denver)
 * today and yesterday. Three UTC days are needed: in the evening the UTC date
 * is already a day ahead, so local yesterday starts two UTC days back. A day
 * whose listing fails contributes nothing, but if every listing fails the
 * archive is unreachable and we throw so the card shows its load error.
 */
export async function fetchLatestFrames(
  schedule: PhotoSchedule,
  cam: StationCamera,
  now = Date.now(),
): Promise<PhotoFrame[]> {
  const days = [utcYmd(now - 2 * DAY_MS), utcYmd(now - DAY_MS), utcYmd(now)]
  const results = await Promise.allSettled(
    cam.currentViews.flatMap((v) => days.map((d) => listDay(schedule, cam, v.token, d))),
  )
  if (results.length > 0 && results.every((r) => r.status === 'rejected')) {
    throw (results[0] as PromiseRejectedResult).reason
  }
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

/**
 * Keep only the derived frames (manifest `webp_large` blank) whose WebP the
 * bucket actually lists. One listing per (token, UTC day) the frames touch
 * (a 404 lists nothing). A failed listing drops that day's derived frames,
 * or with `strict` rejects, so a caller's cache does not keep a partial
 * answer as final.
 */
export async function confirmDerived(
  schedule: PhotoSchedule,
  cam: StationCamera,
  frames: PhotoFrame[],
  opts: { strict?: boolean } = {},
): Promise<PhotoFrame[]> {
  const derived = frames.filter((f) => f.derived)
  if (derived.length === 0) return frames
  const pairs = [...new Set(derived.map((f) => `${f.token}|${utcYmd(f.slotUtcMs)}`))]
  const lists = await Promise.all(
    pairs.map((p) => {
      const [token, day] = p.split('|')
      const listing = listDay(schedule, cam, token, day)
      return opts.strict ? listing : listing.catch(() => [] as PhotoFrame[])
    }),
  )
  const exists = new Set(lists.flat().map((f) => f.webpUrl))
  return frames.filter((f) => !f.derived || exists.has(f.webpUrl))
}

/** Monthly manifest (LOCAL month `YYYY-MM`) → frames; a missing month → []. */
export async function fetchMonthFrames(
  schedule: PhotoSchedule,
  cam: StationCamera,
  ym: string,
): Promise<PhotoFrame[]> {
  const st = cam.station
  const url = `${schedule.base.replace(/\/+$/, '')}/photos/manifest/${st}/${st}_${ym}.csv`
  const csv = await fetchArchiveText(url, 30_000)
  if (!csv) return []
  return parseManifest(csv, st, {
    base: schedule.base,
    patterns: schedule.patterns,
    snapMaxMs: schedule.snapMaxMs,
    labels: cam.allLabels,
  })
}
