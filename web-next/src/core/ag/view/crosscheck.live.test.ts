/**
 * Live cross-check: the client-side Ag Tools pipeline (data hooks' fetchers
 * → compute) against the API's `/derived/daily` (level 2, no `premade`) for
 * the last 30 days. Skipped unless AG_LIVE=1:
 *   AG_LIVE=1 VITE_API_URL=https://mesonet2.climate.umt.edu/api/v2/ \
 *     npx vitest run src/core/ag/view/crosscheck.live.test.ts --silent=false
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fetchText } from '../../api/http'
import { exclusiveEnd } from '../../api/record'
import { cciDaily, cToF, etoDaily, feelsLikeDaily, gdd, mmToIn } from '../compute'
import { fetchDailyMet, fetchStationMeta, parseGddStagesJson } from '../data'
import { denverToday } from '../../today'
import { addDays, denverLocal, parseApiDatetime, parseCsvRaw, toNum } from '../data/parse'
import type { Nullable } from '../contract'

const live = globalThis.process?.env?.AG_LIVE === '1'
const STATION = globalThis.process?.env?.AG_STATION ?? 'acebozem'

async function derived(element: string, start: string, end: string, extra: Record<string, string> = {}) {
  const text = await fetchText('derived/daily/', {
    stations: STATION,
    elements: element,
    start_time: start,
    end_time: exclusiveEnd(end),
    level: 2,
    alpha: 0.23,
    type: 'csv',
    ...extra,
  })
  const rows = parseCsvRaw(text)
  return (col: RegExp) => {
    const out = new Map<string, Nullable>()
    if (rows.length === 0) return out
    const h = Object.keys(rows[0]).find((k) => col.test(k))
    if (!h) throw new Error(`no column ${col} in ${Object.keys(rows[0]).join('|')}`)
    for (const r of rows) out.set(denverLocal(parseApiDatetime(r.datetime)).date, toNum(r[h]))
    return out
  }
}

function diff(dates: string[], ours: Nullable[], api: Map<string, Nullable>) {
  let max = 0
  let n = 0
  let onlyOurs = 0
  let onlyApi = 0
  dates.forEach((d, i) => {
    const a = api.get(d)
    const o = ours[i]
    if (o == null && a == null) return
    if (o == null) return void onlyApi++
    if (a == null) return void onlyOurs++
    n++
    max = Math.max(max, Math.abs(o - a))
  })
  return { n, max, onlyOurs, onlyApi }
}

describe.skipIf(!live)(`live cross-check vs /derived/daily (${STATION}, last 30 days)`, () => {
  it('ETo / GDD(corn) / feels-like / CCI', async () => {
    const end = denverToday()
    const start = addDays(end, -29)
    const [met, meta] = await Promise.all([
      fetchDailyMet({ station: STATION, start, end }),
      fetchStationMeta(STATION),
    ])
    const eto = etoDaily(met, meta)
    const g = gdd(met, { crop: 'corn' })
    const fl = feelsLikeDaily(met)
    const cci = cciDaily(met)
    const [etrApi, gddApi, flApi, cciApi] = await Promise.all([
      derived('etr', start, end),
      derived('gdd', start, end, { crop: 'corn' }),
      derived('feels_like', start, end),
      derived('cci', start, end),
    ])
    const rows = {
      'ETo [in]': diff(eto.time as string[], eto.etoMm.map((v) => mmToIn(v)), etrApi(/Reference ET/)),
      'GDD corn daily [°F·day]': diff(g.date, g.daily, gddApi(/^GDDs/)),
      'GDD corn cumulative [°F·day]': diff(g.date, g.cumulative, gddApi(/^Cumulative GDDs/)),
      'Feels-like [°F]': diff(fl.time as string[], fl.valueC.map((v) => cToF(v)), flApi(/^Feels Like/)),
      'CCI [°F]': diff(cci.time as string[], cci.valueC.map((v) => cToF(v)), cciApi(/Comprehensive Climate Index/)),
    }
    console.log(`${STATION} ${start}..${end}`)
    console.table(rows)
    expect(rows['ETo [in]'].max).toBeLessThanOrEqual(0.005)
    expect(rows['GDD corn daily [°F·day]'].max).toBeLessThanOrEqual(0.0005)
    expect(rows['Feels-like [°F]'].max).toBeLessThanOrEqual(0.1)
    expect(rows['CCI [°F]'].max).toBeLessThanOrEqual(0.1)
  }, 120_000)

  // What the Ag tab draws: GDD wheat with the vendored stage table (NDAWN switch).
  // (SWP / percent saturation have no API reference since mesonet2 dropped them.)
  it('GDD wheat (vendored stages)', async () => {
    const end = denverToday()
    const start = addDays(end, -29)
    const stages = parseGddStagesJson(JSON.parse(readFileSync('public/data/gdd_stages.json', 'utf8')), 'vendored')
    const q = { station: STATION, start, end }
    const [met, gddApi] = await Promise.all([fetchDailyMet(q), derived('gdd', start, end, { crop: 'wheat' })])
    const g = gdd(met, { crop: 'wheat', stages: stages.tables.wheat })
    const rows: Record<string, ReturnType<typeof diff>> = {
      'GDD wheat daily [°F·day]': diff(g.date, g.daily, gddApi(/^GDDs/)),
      'GDD wheat cumulative [°F·day]': diff(g.date, g.cumulative, gddApi(/^Cumulative GDDs/)),
    }
    console.log(`${STATION} ${start}..${end}`)
    console.table(rows)
    // The API rounds to 3 decimals, so "exact" is |Δ| ≤ 0.0005 (plus float noise).
    const EXACT = 0.0005 + 1e-9
    expect(rows['GDD wheat daily [°F·day]'].max).toBeLessThanOrEqual(EXACT)
    expect(rows['GDD wheat cumulative [°F·day]'].max).toBeLessThanOrEqual(EXACT)
  }, 120_000)
})
