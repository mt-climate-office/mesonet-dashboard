/**
 * Live smoke for the Ag data layer. Skipped unless AG_LIVE=1:
 *   AG_LIVE=1 VITE_API_URL=https://mesonet2.climate.umt.edu/api/v2/ npx vitest run src/core/ag/data/live.test.ts
 * Vendored files are served from public/data via a file:// shim.
 */
import { describe, expect, it } from 'vitest'
import soilJsonText from '../../../../public/data/soil_params.json?raw'
import stagesJsonText from '../../../../public/data/gdd_stages.json?raw'
import { loadGddStages } from './gddStages'
import { fetchDailyMet } from './observations'
import { loadSoilParams } from './soilParams'
import { denverToday } from '../../today'
import { addDays } from './parse'
import { fetchForecastDaily } from './forecast'
import { fetchDailyNormals } from './normals'

const live = import.meta.env.VITE_AG_LIVE === '1' || globalThis.process?.env?.AG_LIVE === '1'
const VENDORED = 'http://vendored.local/data/'
const shimFetch: typeof fetch = async (input, init) => {
  const url = String(input)
  if (url === `${VENDORED}soil_params.json`) return new Response(soilJsonText, { headers: { 'content-type': 'application/json' } })
  if (url === `${VENDORED}gdd_stages.json`) return new Response(stagesJsonText, { headers: { 'content-type': 'application/json' } })
  return fetch(input, init)
}

describe.skipIf(!live)('live Ag data sources', () => {
  it('soil params: default (data2 → vendored) and forced vendored', async () => {
    const auto = await loadSoilParams({ vendoredBase: VENDORED, fetchImpl: shimFetch, data2Enabled: true })
    const vend = await loadSoilParams({ vendoredBase: VENDORED, fetchImpl: shimFetch, only: 'vendored' })
    console.log('soil params:', auto.source, auto.release, 'data2Release:', auto.data2Release ?? '(unreachable)')
    expect(vend.rows.length).toBe(507)
    expect(auto.rows.length).toBeGreaterThan(0)
    const d2 = await loadSoilParams({ fetchImpl: shimFetch, only: 'data2' })
    expect(d2.release >= vend.release).toBe(true)
  }, 30_000)

  it('GDD stages: data2 (expected 404 today) falls back to vendored', async () => {
    const auto = await loadGddStages({ vendoredBase: VENDORED, fetchImpl: shimFetch, data2Enabled: true })
    console.log('gdd stages:', auto.source, auto.release)
    expect(auto.tables.wheat.stages.length).toBeGreaterThan(10)
  }, 30_000)

  it('DailyMet for acebozem, last 30 days', async () => {
    const end = denverToday()
    const d = await fetchDailyMet({ station: 'acebozem', start: addDays(end, -29), end })
    console.log('dailyMet:', d.date[0], '→', d.date.at(-1), d.date.length, 'rows; provisional', d.provisional.filter(Boolean).length)
    expect(d.date.length).toBeGreaterThanOrEqual(29)
    expect(d.tmaxC.filter((v) => v !== null).length).toBeGreaterThan(25)
  }, 120_000)

  it('normals + NWS forecast', async () => {
    const n = await fetchDailyNormals('acebozem')
    expect(Object.keys(n!.byMonthDay).length).toBeGreaterThanOrEqual(365)
    const f = await fetchForecastDaily(45.66, -111.07)
    console.log('forecast:', f.status, f.status === 'ok' ? f.forecast.date : f.reason)
  }, 60_000)
})
