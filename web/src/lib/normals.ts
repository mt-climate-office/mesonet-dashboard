import { parseCsv } from './csv'
import type { ObservationRow } from './api'

/**
 * GridMET 1991-2020 normals are pre-computed CSVs hosted in this repo.
 * Each station × variable pair has a CSV with month/day/quantile columns.
 *
 * Mirrors plotting.merge_normal_data in the legacy app.
 */

const NORMALS_BASE =
  'https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/normals'

// Display variable → underlying gridMET variable codes (mirrors
// params.short_name_mapper).
const SHORT_NAME_MAPPER: Record<string, string[]> = {
  Precipitation: ['pr'],
  'Air Temperature': ['tmmn', 'tmmx'],
  'Relative Humidity': ['rmin', 'rmax'],
  'Reference ET': ['pet'],
}

interface NormalRow extends Record<string, unknown> {
  type: string
  variable: string
  month: number
  day: number
  q25: number | null
  q75: number | null
  median: number | null
}

export interface MergedNormal {
  mn: number | null
  mx: number | null
  avg: number | null
}

const cache = new Map<string, NormalRow[]>()

async function loadCsv(station: string, varCode: string): Promise<NormalRow[]> {
  const key = `${station}/${varCode}`
  if (cache.has(key)) return cache.get(key)!
  const url = `${NORMALS_BASE}/${station}_${varCode}.csv`
  const r = await fetch(url)
  if (!r.ok) {
    cache.set(key, [])
    return []
  }
  const text = await r.text()
  const rows = parseCsv<NormalRow>(text)
  // Keep only daily aggregations.
  const daily = rows.filter((row) => row.type === 'daily')
  cache.set(key, daily)
  return daily
}

export interface StationNormals {
  /** Map of "MM-DD" → {mn,mx,avg} */
  byDay: Map<string, MergedNormal>
}

/**
 * Fetch and combine the relevant normals for one station + display variable.
 * Returns null if the variable has no normals or all the fetches failed.
 */
export async function fetchNormals(
  station: string,
  displayVar: string,
): Promise<StationNormals | null> {
  const codes = SHORT_NAME_MAPPER[displayVar]
  if (!codes) return null

  const sets = await Promise.all(codes.map((c) => loadCsv(station, c)))
  if (sets.every((s) => s.length === 0)) return null

  const byDay = new Map<string, MergedNormal>()

  if (codes.length === 2) {
    // tmmn/tmmx (or rmin/rmax) — q25 of "min" var, q75 of "max" var.
    const minSet = sets[0] // tmmn / rmin
    const maxSet = sets[1] // tmmx / rmax
    const mnByDay = new Map<string, number | null>()
    const mxByDay = new Map<string, number | null>()
    for (const r of minSet) {
      mnByDay.set(`${r.month}-${r.day}`, r.q25 ?? null)
    }
    for (const r of maxSet) {
      mxByDay.set(`${r.month}-${r.day}`, r.q75 ?? null)
    }
    const days = new Set([...mnByDay.keys(), ...mxByDay.keys()])
    for (const d of days) {
      const mn = mnByDay.get(d) ?? null
      const mx = mxByDay.get(d) ?? null
      const avg = mn !== null && mx !== null ? (mn + mx) / 2 : null
      byDay.set(d, { mn, mx, avg })
    }
  } else {
    // Single var — use q25/q75/median directly.
    for (const r of sets[0]) {
      byDay.set(`${r.month}-${r.day}`, {
        mn: r.q25 ?? null,
        mx: r.q75 ?? null,
        avg: r.median ?? null,
      })
    }
  }

  return { byDay }
}

/** Merge normals onto each row's date. */
export function mergeNormals(
  rows: ObservationRow[],
  norms: StationNormals,
): Array<{ datetime: string } & MergedNormal> {
  return rows.map((r) => {
    const dt = String(r.datetime ?? '')
    const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return { datetime: dt, mn: null, mx: null, avg: null }
    const month = parseInt(m[2], 10)
    const day = parseInt(m[3], 10)
    const key = `${month}-${day}`
    const nm = norms.byDay.get(key)
    return {
      datetime: dt,
      mn: nm?.mn ?? null,
      mx: nm?.mx ?? null,
      avg: nm?.avg ?? null,
    }
  })
}
