/**
 * Camera registry: `photos/schedule/schedule.json` on the data2 archive.
 * Which stations have a camera, which views they shoot now (and ever have),
 * at which local slots, and since when.
 */

export const PHOTO_BASE = 'https://data2.climate.umt.edu/mesonet/'

export interface PhotoPatterns {
  jpg: string
  webp_large: string
  webp_thumb: string
}

/** Fallback when schedule.json omits `patterns` (the layout as of 2026-10). */
export const DEFAULT_PATTERNS: PhotoPatterns = {
  jpg: 'photos/jpg/{station}/{station}_{token}_{captured_utc}.jpg',
  webp_large: 'photos/webp/large/{station}/{station}_{token}_{slot_utc}.webp',
  webp_thumb: 'photos/webp/thumb/{station}/{station}_{token}_{slot_utc}.webp',
}

interface RawView {
  view?: string
  slots_local?: string[]
}
interface RawPeriod {
  from?: string
  until?: string | null
  views?: Record<string, RawView>
}
interface RawStation {
  first_month?: string
  name?: string
  periods?: RawPeriod[]
}
export interface RawSchedule {
  patterns?: Partial<PhotoPatterns> & { base?: string }
  snap_max_seconds?: number
  stations?: Record<string, RawStation>
}

export interface PhotoView {
  token: string
  label: string
}

export interface PhotoPeriod {
  fromMs: number
  /** null = current period. */
  untilMs: number | null
  views: { token: string; label: string; slotsLocal: string[] }[]
}

export interface StationCamera {
  station: string
  name: string
  /** `YYYY-MM` of the first archived month. */
  firstMonth: string | null
  /** Views of the current period (`until === null`), in display order. */
  currentViews: PhotoView[]
  /** token → label for every view the station has ever had. */
  allLabels: Record<string, string>
  periods: PhotoPeriod[]
}

export interface PhotoSchedule {
  base: string
  patterns: PhotoPatterns
  snapMaxMs: number
  stations: Map<string, StationCamera>
}

/** Legacy direction words (app.py update_ul_card). */
const LEGACY_LABELS: Record<string, string> = {
  N: 'North',
  S: 'South',
  E: 'East',
  W: 'West',
  NS: 'North Sky',
  SS: 'South Sky',
  G: 'Ground',
  SNOW: 'Snow',
}

/** West first (user decision 2026-10-08): it opens the carousel and the dialog. */
const DIRECTION_ORDER = ['W', 'E', 'N', 'S', 'SNOW', 'NS', 'SS', 'G']

/** Legacy label for a token, else the schedule's view name, else the token. */
export function directionLabel(token: string, view?: string): string {
  const t = token.toUpperCase()
  return LEGACY_LABELS[t] ?? (view && view !== token ? view : token)
}

/** Canonical W/E/N/S/Snow/sky order; unknown tokens last, alphabetically. */
export function compareTokens(a: string, b: string): number {
  const rank = (t: string) => {
    const i = DIRECTION_ORDER.indexOf(t.toUpperCase())
    return i < 0 ? 99 : i
  }
  return rank(a) - rank(b) || a.localeCompare(b)
}

export function parseSchedule(doc: RawSchedule): PhotoSchedule {
  const stations = new Map<string, StationCamera>()
  for (const [id, st] of Object.entries(doc.stations ?? {})) {
    const allLabels: Record<string, string> = {}
    const periods: PhotoPeriod[] = (st.periods ?? []).map((p) => {
      const tokens = Object.keys(p.views ?? {}).sort(compareTokens)
      const views = tokens.map((token) => {
        const v = p.views![token]
        const label = directionLabel(token, v.view)
        allLabels[token] = label
        return { token, label, slotsLocal: v.slots_local ?? [] }
      })
      const fromMs = p.from ? Date.parse(p.from) : Number.NEGATIVE_INFINITY
      const untilMs = p.until == null ? null : Date.parse(p.until)
      return { fromMs, untilMs, views }
    })
    const current = periods.find((p) => p.untilMs === null) ?? null
    stations.set(id, {
      station: id,
      name: st.name ?? id,
      firstMonth: st.first_month ?? null,
      currentViews: (current?.views ?? []).map(({ token, label }) => ({ token, label })),
      allLabels,
      periods,
    })
  }
  const { base, ...pats } = doc.patterns ?? {}
  return {
    base: base ?? PHOTO_BASE,
    patterns: { ...DEFAULT_PATTERNS, ...pats },
    snapMaxMs: (doc.snap_max_seconds ?? 1800) * 1000,
    stations,
  }
}

/** True when the station has a current schedule period with at least one view. */
export function hasCamera(schedule: PhotoSchedule | undefined, station: string | null): boolean {
  if (!schedule || !station) return false
  return (schedule.stations.get(station)?.currentViews.length ?? 0) > 0
}

/** Tokens of every period overlapping [startMs, endMs). */
export function viewsBetween(cam: StationCamera, startMs: number, endMs: number): PhotoView[] {
  const seen = new Map<string, string>()
  for (const p of cam.periods) {
    if (p.fromMs >= endMs) continue
    if (p.untilMs !== null && p.untilMs <= startMs) continue
    for (const v of p.views) seen.set(v.token, v.label)
  }
  return [...seen.entries()]
    .sort((a, b) => compareTokens(a[0], b[0]))
    .map(([token, label]) => ({ token, label }))
}
