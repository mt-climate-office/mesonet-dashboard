/**
 * gridMET 1991–2020 daily normals → contract `DailyNormals` (SI).
 *
 * Same source as `lib/normals.ts` (pre-computed CSVs in this repo's
 * `normals/`, served from GitHub raw). Those CSVs are in US units: tmmn/tmmx
 * °F, pr/pet inches. Only `type == "daily"` rows are used.
 */
import type { DailyNormal, DailyNormals, Nullable } from '../contract'
import { fToC, inToMm, parseCsvRaw, toNum, type RawRow } from './parse'

export const NORMALS_BASE =
  'https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/normals'

export const NORMAL_VARS = ['tmmn', 'tmmx', 'pr', 'pet'] as const
export type NormalVar = (typeof NORMAL_VARS)[number]

const mmdd = (month: number, day: number) =>
  `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const conv = (f: (x: number) => number, v: Nullable) => (v === null ? null : f(v))

/** Per-variable CSV rows (possibly empty when a file is missing) → DailyNormals. */
export function buildDailyNormals(
  station: string,
  csv: Partial<Record<NormalVar, RawRow[]>>,
): DailyNormals {
  const byMonthDay: Record<string, DailyNormal> = {}
  const slot = (k: string): DailyNormal =>
    (byMonthDay[k] ??= {
      tminC: { q25: null, median: null, q75: null },
      tmaxC: { q25: null, median: null, q75: null },
      prMm: null,
      petMm: null,
    })
  for (const v of NORMAL_VARS) {
    for (const r of csv[v] ?? []) {
      if (r.type !== 'daily') continue
      const month = toNum(r.month)
      const day = toNum(r.day)
      if (month === null || day === null) continue
      const s = slot(mmdd(month, day))
      if (v === 'tmmn' || v === 'tmmx') {
        const q = {
          q25: conv(fToC, toNum(r.q25)),
          median: conv(fToC, toNum(r.median)),
          q75: conv(fToC, toNum(r.q75)),
        }
        if (v === 'tmmn') s.tminC = q
        else s.tmaxC = q
      } else if (v === 'pr') {
        s.prMm = conv(inToMm, toNum(r.median))
      } else {
        s.petMm = conv(inToMm, toNum(r.median))
      }
    }
  }
  return { station, byMonthDay }
}

/**
 * Fetch the four normals CSVs for a station. A missing file contributes
 * nulls; returns null only when every file is missing.
 */
export async function fetchDailyNormals(
  station: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DailyNormals | null> {
  const sets = await Promise.all(
    NORMAL_VARS.map(async (v) => {
      try {
        const r = await fetchImpl(`${NORMALS_BASE}/${station}_${v}.csv`)
        if (!r.ok) return [v, []] as const
        return [v, parseCsvRaw(await r.text())] as const
      } catch {
        return [v, []] as const
      }
    }),
  )
  if (sets.every(([, rows]) => rows.length === 0)) return null
  return buildDailyNormals(station, Object.fromEntries(sets))
}
