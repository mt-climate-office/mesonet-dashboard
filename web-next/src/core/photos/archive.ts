/**
 * Pure helpers over the data2 photo archive layout: path builders from the
 * schedule's `patterns`, the monthly manifest CSV, the S3 listing XML, and
 * day selection over the resulting frames.
 */
import { DEFAULT_PATTERNS, PHOTO_BASE, compareTokens, type PhotoPatterns } from './schedule'
import { compactUtc, localYmd, parseUtc } from './time'

export interface PhotoFrame {
  token: string
  label: string
  /** The capture slot (UTC instant) — the WebP key's timestamp. */
  slotUtcMs: number
  /** Actual capture time, when the source knows it (manifest only). */
  capturedUtcMs?: number
  /** Display image (webp_large). Also what "Download original" saves. */
  webpUrl: string
  thumbUrl: string
  /** Full-resolution original, when the manifest names it. Not used by the UI. */
  jpgUrl?: string
  /**
   * True when the manifest left `webp_large` blank and the WebP path was
   * derived. Such a WebP may not exist (as of 2026-10 most don't), so the UI
   * confirms it against a bucket listing before showing it.
   */
  derived?: boolean
}

export interface PathVars {
  station: string
  token: string
  slotUtcMs?: number
  capturedUtcMs?: number
}

/** Fill a schedule pattern (`{station}`, `{token}`, `{slot_utc}`, `{captured_utc}`). */
export function fillPattern(pattern: string, v: PathVars): string {
  return pattern
    .replaceAll('{station}', v.station)
    .replaceAll('{token}', v.token)
    .replaceAll('{slot_utc}', v.slotUtcMs == null ? '' : compactUtc(v.slotUtcMs))
    .replaceAll('{captured_utc}', v.capturedUtcMs == null ? '' : compactUtc(v.capturedUtcMs))
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/** Directory prefix of a pattern up to (not including) the timestamp, e.g. `photos/webp/large/x/x_N_`. */
export function patternPrefix(pattern: string, station: string, token: string): string {
  const head = pattern.split(/\{(?:slot_utc|captured_utc)\}/)[0]
  return fillPattern(head, { station, token })
}

/** URL basename (`acebozem_N_20261001T150000Z.webp`). */
export function basename(url: string): string {
  return url.split('?')[0].split('/').pop() ?? url
}

export interface ArchiveOpts {
  base?: string
  patterns?: PhotoPatterns
  /** Max capture↔slot distance that still has a WebP (schedule `snap_max_seconds`). */
  snapMaxMs?: number
  labels?: Record<string, string>
}

function frameFor(
  station: string,
  token: string,
  slotUtcMs: number,
  o: ArchiveOpts,
  extra: Partial<PhotoFrame> = {},
): PhotoFrame {
  const base = o.base ?? PHOTO_BASE
  const p = o.patterns ?? DEFAULT_PATTERNS
  return {
    token,
    label: o.labels?.[token] ?? token,
    slotUtcMs,
    webpUrl: joinUrl(base, fillPattern(p.webp_large, { station, token, slotUtcMs })),
    thumbUrl: joinUrl(base, fillPattern(p.webp_thumb, { station, token, slotUtcMs })),
    ...extra,
  }
}

/**
 * S3 ListObjectsV2 XML → keys. Entities in keys are unlikely but decoded.
 */
export function parseListingKeys(xml: string): string[] {
  const out: string[] = []
  for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
    out.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
  }
  return out
}

/** WebP listing for one station/token → frames (slot time from the key). */
export function framesFromListing(
  xml: string,
  station: string,
  token: string,
  o: ArchiveOpts = {},
): PhotoFrame[] {
  const frames: PhotoFrame[] = []
  for (const key of parseListingKeys(xml)) {
    const t = key.match(/_(\d{8}T\d{6}Z)\.webp$/)
    if (!t) continue
    const ms = parseUtc(t[1])
    if (Number.isNaN(ms)) continue
    frames.push({ ...frameFor(station, token, ms, o), webpUrl: joinUrl(o.base ?? PHOTO_BASE, key) })
  }
  return frames
}

/** Minimal CSV line split (manifest fields carry no commas, but quotes are honoured). */
function splitCsvLine(line: string): string[] {
  if (!line.includes('"')) return line.split(',')
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

const HOUR_MS = 3_600_000

/**
 * Monthly manifest CSV (`station,view,token,captured_utc,…,slot_utc,jpg,webp_large,webp_thumb`)
 * → frames, one per WebP (a re-shot slot is deduplicated).
 *
 * Quirks: `webp_large` can be blank for frames whose WebP exists, so the
 * path is derived from `slot_utc`, or from the capture time snapped to the
 * nearest hour, and the frame is flagged `derived`; a capture farther than
 * `snapMaxMs` from that slot has no WebP and is skipped (jpg only). As of
 * 2026-10 most blank-`webp_large` rows really have no WebP (e.g. acecrowa's
 * sky views after 2026-09-07, ad-hoc test captures), so derived frames must
 * be confirmed against a listing (`confirmDerived`) before display.
 */
export function parseManifest(csv: string, station: string, o: ArchiveOpts = {}): PhotoFrame[] {
  const lines = csv.replace(/\r/g, '').trim().split('\n')
  if (lines.length < 2) return []
  const header = splitCsvLine(lines[0]).map((h) => h.trim())
  const col = (name: string) => header.indexOf(name)
  const iToken = col('token')
  const iView = col('view')
  const iCaptured = col('captured_utc')
  const iSlot = col('slot_utc')
  const iJpg = col('jpg')
  const iWebp = col('webp_large')
  const iThumb = col('webp_thumb')
  const snap = o.snapMaxMs ?? 30 * 60_000
  const base = o.base ?? PHOTO_BASE
  const frames = new Map<string, PhotoFrame>()
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const f = splitCsvLine(line)
    const at = (i: number) => (i >= 0 ? (f[i] ?? '').trim() : '')
    const token = at(iToken)
    const captured = parseUtc(at(iCaptured))
    if (!token || Number.isNaN(captured)) continue
    const slotRaw = at(iSlot)
    const slot = slotRaw ? parseUtc(slotRaw) : Math.round(captured / HOUR_MS) * HOUR_MS
    if (Number.isNaN(slot) || Math.abs(slot - captured) > snap) continue
    const frame = frameFor(station, token, slot, o, { capturedUtcMs: captured })
    if (!o.labels?.[token] && at(iView)) frame.label = at(iView)
    if (at(iWebp)) frame.webpUrl = joinUrl(base, at(iWebp))
    else frame.derived = true
    if (at(iThumb)) frame.thumbUrl = joinUrl(base, at(iThumb))
    if (at(iJpg)) frame.jpgUrl = joinUrl(base, at(iJpg))
    const prev = frames.get(frame.webpUrl)
    if (!prev || (prev.derived && !frame.derived)) frames.set(frame.webpUrl, frame)
  }
  return [...frames.values()]
}

/**
 * Frames whose slot falls on local day `ymd` (America/Denver), optionally for
 * one token, newest first.
 */
export function framesFor(frames: PhotoFrame[], ymd: string, token?: string): PhotoFrame[] {
  return frames
    .filter((f) => (token == null || f.token === token) && localYmd(f.slotUtcMs) === ymd)
    .sort((a, b) => b.slotUtcMs - a.slotUtcMs)
}

/** Distinct tokens in `frames`, canonical order. */
export function tokensOf(frames: PhotoFrame[]): string[] {
  return [...new Set(frames.map((f) => f.token))].sort(compareTokens)
}
