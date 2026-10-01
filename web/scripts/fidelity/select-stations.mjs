// Derive the fidelity station matrix from live mesonet2 metadata and write
// stations.json (committed). Re-run when the network changes:
//   node scripts/fidelity/select-stations.mjs [--refresh]
//
// Sources: /stations/?type=csv, /config/{s}/ (instruments incl. cameras,
// date_end, outage_ranges), /photos/?type=csv (slow), /elements/{s}/ (to
// confirm well_* / soil elements for the chosen stations only).
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { API, CACHE_DIR } from './config.mjs'
import { fetchText, parseCsv, pool, writeJson, isoDate, daysAgo } from './lib/util.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const refresh = process.argv.includes('--refresh')
const DAY = 86_400_000
const maxAgeMs = refresh ? 1 : 7 * DAY

const get = async (path, name) => {
  const r = await fetchText(`${API.v2}${path}`, { cacheFile: join(CACHE_DIR, name), maxAgeMs })
  if (!r.ok) throw new Error(`${r.status} ${r.url}`)
  return r.text
}

const stations = parseCsv(await get('stations/?type=csv', 'stations.csv'))
console.log(`stations: ${stations.length}`)
const photos = parseCsv(await get('photos/?type=csv', 'photos.csv'))
const photoMap = new Map(photos.map((p) => [p['Station ID'], p]))

const configs = new Map()
await pool(stations, 4, async (s) => {
  try {
    configs.set(s.station, JSON.parse(await get(`config/${s.station}/`, `config-${s.station}.json`)))
  } catch (e) {
    console.warn(`config ${s.station}: ${e.message}`)
  }
})

// Cameras are only in /deployments (type "IP Camera"), which legacy uses to pick
// photo directions (app.py:1297-1322: EC-ScoutIP -> n/s/e/w/snow, else n/s/ns/ss).
const deployments = new Map()
await pool(stations.filter((s) => s.sub_network === 'HydroMet'), 4, async (s) => {
  try {
    deployments.set(s.station, parseCsv(await get(`deployments/${s.station}/?type=csv`, `deployments-${s.station}.csv`)))
  } catch (e) {
    console.warn(`deployments ${s.station}: ${e.message}`)
  }
})

const asList = (e) => (Array.isArray(e) ? e : e ? [e] : [])
const isNone = (v) => v === null || v === undefined || v === 'None' || v === ''
const today = new Date()

const info = stations.map((s) => {
  const cfg = configs.get(s.station) ?? {}
  const inst = cfg.instruments ?? []
  const cams = (deployments.get(s.station) ?? []).filter((d) => d.type === 'IP Camera')
  const elems = new Set(inst.flatMap((i) => asList(i.elements)))
  const ended = inst.filter((i) => !isNone(i.date_end))
  const outages = inst.filter((i) => i.outage_ranges && i.outage_ranges !== 'None' && asList(i.outage_ranges).length)
  // a "replacement" = an ended instrument whose element set is covered by a newer one
  const replaced = ended.filter((i) =>
    inst.some((j) => j !== i && j.date_start >= i.date_end && asList(j.elements).some((e) => asList(i.elements).includes(e))),
  )
  const ph = photoMap.get(s.station)
  return {
    ...s,
    status: cfg.status,
    has_swp: s.has_swp === 'True',
    funded: s.funded === 'True',
    cameraModels: [...new Set(cams.map((c) => c.model))],
    photoDirs: ph ? ph['Photo Directions'] : null,
    hasWell: [...elems].some((e) => /^well_/.test(e)),
    nEnded: ended.length,
    nReplaced: replaced.length,
    nOutageRanges: outages.length,
    ageDays: Math.round((today - new Date(s.date_installed)) / DAY),
  }
})

const active = info.filter((s) => s.status !== 'inactive' && s.ageDays >= 0)
const picked = new Map()
const pick = (role, cands, why, { preferPicked = true } = {}) => {
  // prefer a station already picked (fewer stations, more roles each), else first
  const c = (preferPicked && cands.find((s) => picked.has(s.station))) || cands[0]
  if (!c) {
    console.warn(`no candidate for ${role}`)
    return
  }
  const cur = picked.get(c.station) ?? { station: c.station, name: c.name, sub_network: c.sub_network, has_swp: c.has_swp, nwsli_id: c.nwsli_id || null, date_installed: c.date_installed, cameraModels: c.cameraModels, roles: [], why: [] }
  cur.roles.push(role)
  cur.why.push(why(c))
  picked.set(c.station, cur)
}
const byAge = (a, b) => b.ageDays - a.ageDays // oldest first -> more history
const established = active.filter((s) => s.ageDays > 400).sort(byAge)

const scout = established.filter((s) => s.sub_network === 'HydroMet' && s.cameraModels.some((m) => /scout/i.test(m)))
pick('hydromet-ec-scoutip', scout.filter((s) => s.has_swp && s.nwsli_id), (c) => `HydroMet, camera ${c.cameraModels.join('/')}`)
const otherCam = established.filter(
  (s) => s.sub_network === 'HydroMet' && s.cameraModels.length && !s.cameraModels.some((m) => /scout/i.test(m)),
)
pick('hydromet-other-camera', otherCam, (c) => `HydroMet, camera ${c.cameraModels.join('/')}`)
pick('agrimet', established.filter((s) => s.sub_network === 'AgriMet'), (c) => `AgriMet (2.44 m wind, no camera), installed ${c.date_installed}`)
pick('has-swp', established.filter((s) => s.has_swp), () => 'has_swp=True (SWP / percent saturation available)')
pick('no-swp', established.filter((s) => !s.has_swp && s.sub_network === 'HydroMet'), () => 'has_swp=False (SWP must be hidden/filtered)')

// co-located pair: identical lat/lon
const byLoc = new Map()
for (const s of active) {
  const k = `${s.latitude},${s.longitude}`
  byLoc.set(k, [...(byLoc.get(k) ?? []), s])
}
const pairs = [...byLoc.values()].filter((g) => g.length > 1)
if (pairs.length) {
  const g = pairs.sort((a, b) => b.length - a.length || byAge(a[0], b[0]))[0]
  for (const s of g.slice(0, 2)) {
    pick('co-located', [s], () => `co-located with ${g.filter((x) => x !== s).map((x) => x.station).join(',')} at ${s.latitude},${s.longitude}`)
  }
}
pick('well', active.filter((s) => s.hasWell).sort(byAge), () => 'has well_* elements (groundwater)')
pick('nwsli', established.filter((s) => s.nwsli_id), (c) => `nwsli_id=${c.nwsli_id} (deep link /dash/${c.nwsli_id})`)
pick(
  'sensor-change',
  established.filter((s) => s.nReplaced > 0 && s.nOutageRanges > 0).sort((a, b) => b.nOutageRanges - a.nOutageRanges || b.nReplaced - a.nReplaced),
  (c) => `${c.nReplaced} replaced instruments, ${c.nOutageRanges} with outage_ranges (sensor add/remove/outage overlays)`,
  { preferPicked: false },
)
const recent = active.filter((s) => s.ageDays >= 21 && s.ageDays <= 365).sort((a, b) => a.ageDays - b.ageDays)
pick('recent-install', recent, (c) => `installed ${c.date_installed} (${c.ageDays} d ago; short period of record)`)

const out = {
  generated: isoDate(today),
  source: API.v2,
  note: 'Generated by select-stations.mjs. Each station lists every matrix role it covers.',
  candidates: {
    colocatedGroups: pairs.map((g) => g.map((s) => s.station)),
    cameraModels: [...new Set(info.flatMap((s) => s.cameraModels))],
    wellStations: info.filter((s) => s.hasWell).map((s) => s.station),
    recentInstalls: recent.slice(0, 5).map((s) => `${s.station} ${s.date_installed}`),
    since: isoDate(daysAgo(365)),
  },
  stations: [...picked.values()].map((p) => ({ ...p, why: p.why.join('; ') })),
}
await writeJson(join(__dirname, 'stations.json'), out)
console.table(out.stations.map((s) => ({ station: s.station, roles: s.roles.join(','), why: s.why.slice(0, 90) })))
console.log(JSON.stringify(out.candidates, null, 1))
