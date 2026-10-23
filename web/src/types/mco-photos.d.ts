/**
 * Types for `MCO.photos` (mco-web-style photos/mco-photos.js, pinned in index.html after core).
 * Hand-written from the module's source comments (0.15.0); only what the dashboard calls, plus the shapes it reads.
 * The kit ships no types: when the pin moves, re-read the module and update these.
 */

/** One view's dated stretch at a station, already clipped to the audience's range (public: D7). */
export interface PhotoWindow {
  token: string
  label: string
  /** Mountain wall-clock slots, 'HH:MM'. */
  slots: string[]
  fromMs: number
  /** Infinity = the current period. */
  untilMs: number
}

export interface PhotoView {
  token: string
  label: string
}

export interface StationCamera {
  station: string
  name: string
  /** `YYYY-MM` of the first archived month, or null. */
  firstMonth: string | null
  /** Never empty: a station with no window this audience may see is left out of the schedule. */
  windows: PhotoWindow[]
  /** Views of the current period, display order (N, E, S, W). */
  currentViews: PhotoView[]
  /** token → label for every view in `windows`. */
  allLabels: Record<string, string>
}

export interface PhotoPatterns {
  jpg: string
  webp_large: string
  webp_thumb: string
}

export interface PhotoSchedule {
  base: string
  patterns: PhotoPatterns
  snapMaxMs: number
  internal: boolean
  /** Public views with no date floor and pre-cutover N and S kept (0.15.0, website D16). */
  fullHistory: boolean
  sinceMs: number
  generated: string | null
  stations: Map<string, StationCamera>
  /** Every view offered anywhere, display order. */
  tokens: string[]
  /** Every slot any window lists, 'HH:MM', sorted. */
  candidates: string[]
  /** The first Mountain date that offers a slot ('YYYY-MM-DD'; public default: 2026-10-22), or null. */
  minDate: string | null
}

export interface PhotoFrame {
  token: string
  label: string
  /** The capture slot (UTC instant): the WebP key's timestamp. */
  slotUtcMs: number
  /** Actual capture time, when the source knows it (manifest only). */
  capturedUtcMs?: number
  /** Display image (webp_large). Also what "Download original" saves. */
  webpUrl: string
  thumbUrl: string
  /** Full-resolution original, when the manifest names it. */
  jpgUrl?: string
  /** The manifest left `webp_large` blank and the path was derived: confirm it (confirmDerived) before showing it. */
  derived?: boolean
}

export interface RawSchedule {
  schema?: number
  generated?: string
  patterns?: Partial<PhotoPatterns> & { base?: string }
  snap_max_seconds?: number
  stations: Record<
    string,
    {
      first_month?: string
      name?: string
      periods?: { from?: string; until?: string | null; views?: Record<string, { view?: string; slots_local?: string[] }> }[]
    }
  >
}

export interface ArchiveOpts {
  base?: string
  patterns?: PhotoPatterns
  snapMaxMs?: number
  labels?: Record<string, string>
  /** Which (token, slot) to keep; default the public rule (MCO.photos.frameFilter(null)). */
  allow?: (token: string, slotUtcMs: number) => boolean
}

/** A station id or its schedule entry. */
type StationRef = string | StationCamera

export interface McoPhotos {
  BASE: string
  DEFAULT_VIEW: string
  /** The public views, display order: N, E, S, W. */
  PUBLIC: readonly string[]
  /** ISO instant the public range starts at (D7). */
  PUBLIC_SINCE: string

  /**
   * Fetch and parse schedule.json (cached per base/audience/history; `fresh` refetches). Public by default,
   * from 2026-10-22; `fullHistory` keeps the public views' whole archive, pre-cutover N and S included.
   */
  load(opts?: { base?: string; internal?: boolean; fullHistory?: boolean; since?: string | number | null; fresh?: boolean; timeoutMs?: number }): Promise<PhotoSchedule>
  parseSchedule(doc: RawSchedule, opts?: { internal?: boolean; fullHistory?: boolean; since?: string | number | null; base?: string }): PhotoSchedule
  hasCamera(schedule: PhotoSchedule | null | undefined, station: StationRef | null | undefined): boolean
  viewsBetween(station: StationCamera, startMs: number, endMs: number): PhotoView[]

  isPublic(token: string): boolean
  /** The curated label ('North'), else the schedule's view name, else the token. */
  label(token: string, viewName?: string): string
  compareViews(a: string, b: string): number

  /** Mountain 'YYYY-MM-DD' + 'HH:MM[:SS]' → UTC ms (DST-safe). */
  toUtcMs(ymd: string, hhmm?: string): number
  toWallClock(ms: number): { date: string; time: string }
  /** Mountain calendar day of an instant, 'YYYY-MM-DD'. */
  localYmd(ms: number): string
  utcYmd(ms: number): string
  compactUtc(ms: number): string
  parseUtc(s: string): number
  /** '3:00 PM' (Mountain Time). */
  timeLabel(ms: number): string
  /** 'Oct 1, 2026 3:00 PM' (Mountain Time). */
  stampLabel(ms: number): string

  basename(url: string): string
  frameFilter(schedule: PhotoSchedule | null): (token: string, slotUtcMs: number) => boolean
  framesFromListing(xml: string, station: string, token: string, o?: ArchiveOpts): PhotoFrame[]
  parseManifest(csv: string, station: string, o?: ArchiveOpts): PhotoFrame[]
  /** Frames on Mountain day `ymd`, optionally one token, newest first. */
  framesFor(frames: PhotoFrame[], ymd: string, token?: string): PhotoFrame[]
  /** Distinct tokens, display order. */
  tokensOf(frames: readonly PhotoFrame[]): string[]

  /** Today's and yesterday's (Mountain) frames of every current view, from the bucket listings. */
  fetchLatestFrames(schedule: PhotoSchedule, station: StationRef, opts?: { now?: number }): Promise<PhotoFrame[]>
  /** One Mountain month's manifest ('YYYY-MM'); a missing month → []. */
  fetchMonthFrames(schedule: PhotoSchedule, station: StationRef, ym: string): Promise<PhotoFrame[]>
  /** Keep only the derived frames the bucket lists; `strict` rejects on a failed listing. */
  confirmDerived(schedule: PhotoSchedule, station: StationRef, frames: PhotoFrame[], opts?: { strict?: boolean }): Promise<PhotoFrame[]>
}
