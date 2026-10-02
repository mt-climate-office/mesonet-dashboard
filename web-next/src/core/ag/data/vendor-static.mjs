#!/usr/bin/env node
/**
 * Regenerates the vendored Ag static data in `web-next/public/data/`:
 *
 *   soil_params.json  ← mesonet-soils build/processed/<release>/compat/
 *                       {soil_parameters,soil_porosity,soil_raw_data}.csv
 *   gdd_stages.json   ← mesonet-db-rds derived/{combined_stages.tsv,
 *                       write_hemp_table.sql}
 *   MANIFEST.json     provenance (source repo, path, commit SHA, capture date)
 *
 * Usage (from web-next/):
 *   node src/core/ag/data/vendor-static.mjs \
 *     --soils ../../mesonet-soils --release 2026-09-25 \
 *     --rds ../../mesonet-db-rds
 *
 * Not bundled (nothing imports it). Requires git on PATH for the SHAs.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, '../../../..')
const outDir = join(webRoot, 'public/data')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const soilsRepo = resolve(arg('soils', join(webRoot, '../../mesonet-soils')))
const release = arg('release', '2026-09-25')
const rdsRepo = resolve(arg('rds', join(webRoot, '../../mesonet-db-rds')))

const gitSha = (repo) =>
  execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const gitDirty = (repo, path) =>
  execFileSync('git', ['-C', repo, 'status', '--porcelain', '--', path], {
    encoding: 'utf8',
  }).trim() !== ''

const readCsv = (p, delimiter = ',') =>
  Papa.parse(readFileSync(p, 'utf8'), { header: true, skipEmptyLines: true, delimiter }).data

/** 12 significant digits: drops float noise like 47.740000000000005. */
const tidy = (x) => Number(Number(x).toPrecision(12))

/* ---------------------------------------------------------------- soils */
const compatRel = `build/processed/${release}/compat`
const compat = join(soilsRepo, compatRel)
const params = readCsv(join(compat, 'soil_parameters.csv'))
const porosity = readCsv(join(compat, 'soil_porosity.csv'))
const raw = readCsv(join(compat, 'soil_raw_data.csv'))
const soilsManifest = JSON.parse(
  readFileSync(join(soilsRepo, `build/processed/${release}/manifest.json`), 'utf8'),
)

const FX_KEYS = ['r', 's', 'n', 'm', 'h']
const VG_KEYS = ['r', 's', 'a', 'n']
const byKey = new Map()
const keyOf = (station, depth) => `${station}|${depth}`
const entry = (station, depth) => {
  const k = keyOf(station, depth)
  if (!byKey.has(k)) {
    byKey.set(k, {
      station,
      // compat depth = -10 × cm (negative millimetres)
      depthCm: Math.round(-Number(depth) / 10),
      fx: null,
      vg: null,
      porosity: null,
      min: null,
      max: null,
    })
  }
  return byKey.get(k)
}
for (const row of params) {
  const obj = JSON.parse(row.params)[0]
  const e = entry(row.station, row.depth)
  if (row.model === 'FX') e.fx = FX_KEYS.map((k) => tidy(obj[k]))
  else if (row.model === 'VG') e.vg = VG_KEYS.map((k) => tidy(obj[k]))
}
for (const row of porosity) entry(row.station, row.depth).porosity = tidy(row.porosity)
for (const row of raw) {
  const e = byKey.get(keyOf(row.station, row.depth))
  if (!e) continue // retention points without a fit are not usable for SWP
  const v = Number(row.vwc) * 100 // fraction → %
  e.min = e.min === null ? v : Math.min(e.min, v)
  e.max = e.max === null ? v : Math.max(e.max, v)
}
const soilRows = [...byKey.values()]
  .sort((a, b) => a.station.localeCompare(b.station) || a.depthCm - b.depthCm)
  .map((e) => [
    e.station,
    e.depthCm,
    e.fx,
    e.vg,
    e.porosity,
    e.min === null ? null : tidy(e.min),
    e.max === null ? null : tidy(e.max),
  ])
const soilJson = {
  release,
  fxKeys: FX_KEYS,
  vgKeys: VG_KEYS,
  columns: ['station', 'depthCm', 'fx', 'vg', 'porosityPct', 'labVwcMinPct', 'labVwcMaxPct'],
  rows: soilRows,
}

/* ---------------------------------------------------------------- stages */
const NUMERIC_STAGE_CROPS = new Set(['wheat', 'barley'])
const na = (s) => (s === undefined || s === null || s === '' || s === 'NA' ? null : s)
const stageRows = readCsv(join(rdsRepo, 'derived/combined_stages.tsv'), '\t').map((r) => ({
  crop: r.crop,
  code: r.stage,
  name: na(r.name),
  description: na(r.description),
  gdd: na(r.gdds) === null ? null : Number(r.gdds),
}))
// write_hemp_table.sql: ('hemp', 'code', 'name', NULL|'desc', gdd)
const hempSql = readFileSync(join(rdsRepo, 'derived/write_hemp_table.sql'), 'utf8')
const tupleRe = /\('hemp',\s*'([^']*)',\s*'([^']*)',\s*(NULL|'[^']*'),\s*([\d.]+)\)/g
for (const m of hempSql.matchAll(tupleRe)) {
  stageRows.push({
    crop: 'hemp',
    code: m[1],
    name: m[2],
    description: m[3] === 'NULL' ? null : m[3].slice(1, -1),
    gdd: Number(m[4]),
  })
}
const crops = { wheat: [], barley: [], canola: [], corn: [], sugarbeet: [], sunflower: [], hemp: [] }
for (const crop of Object.keys(crops)) {
  // The API drops stages without a GDD threshold and sorts by gdd.
  const rows = stageRows
    .filter((r) => r.crop === crop && r.gdd !== null)
    .sort((a, b) => a.gdd - b.gdd)
  crops[crop] = rows.map((r, i) => ({
    stage: NUMERIC_STAGE_CROPS.has(crop) ? Number(r.code) : i + 1,
    code: r.code,
    name: r.name,
    description: r.description,
    gdd: r.gdd,
  }))
}
const stagesJson = { units: 'degF_day', release: `mesonet-db-rds@${gitSha(rdsRepo).slice(0, 7)}`, crops }

/* -------------------------------------------------------------- manifest */
const today = new Date().toISOString().slice(0, 10)
const manifest = {
  generated_by: 'web/src/features/ag/data/vendor-static.mjs',
  captured_at: today,
  files: {
    'soil_params.json': {
      source_repo: 'mt-climate-office/mesonet-soils',
      source_paths: [
        `${compatRel}/soil_parameters.csv`,
        `${compatRel}/soil_porosity.csv`,
        `${compatRel}/soil_raw_data.csv`,
      ],
      source_commit: gitSha(soilsRepo),
      build_generator_sha: soilsManifest.generator?.git_sha ?? null,
      build_generator_dirty: soilsManifest.generator?.git_dirty ?? null,
      release,
      build_generated_at: soilsManifest.generated_at ?? null,
      rows: soilRows.length,
      transform:
        'One row per (station, depth). depthCm = -depth/10. fx = FX params[0] (r,s,n,m,h; h kPa), ' +
        'vg = VG params[0] (r,s,a,n; a 1/kPa), porosityPct = HYPROP initial water content (Vol%), ' +
        'labVwcMin/MaxPct = min/max of soil_raw_data.vwc × 100 for that (station, depth).',
      data2_url: 'https://data2.climate.umt.edu/mesonet/soils/processed/latest/compat/',
      license:
        'Montana Climate Office / Montana Mesonet soil laboratory data; public, see https://climate.umt.edu/about/agreement/',
    },
    'gdd_stages.json': {
      source_repo: 'mt-climate-office/mesonet-db-rds',
      source_paths: ['derived/combined_stages.tsv', 'derived/write_hemp_table.sql'],
      source_commit: gitSha(rdsRepo),
      source_dirty: gitDirty(rdsRepo, 'derived'),
      transform:
        'Keyed by crop; stages with NA gdds dropped and sorted by gdd (as the API does). ' +
        '`stage` is the Haun number for wheat/barley, else a 1-based ordinal; `code` is the published stage label. ' +
        'Corn has no table (empty list).',
      known_differences:
        'Deployed derived.stages labels hemp stage 1 "BBCH Stage 11"; write_hemp_table.sql says "BBCH Stages 0-11". Vendored from the SQL.',
      data2_url: 'https://data2.climate.umt.edu/mesonet/derived/gdd_stages.json (planned)',
      license: 'Montana Climate Office; stage tables compiled from NDAWN / extension publications.',
    },
  },
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'soil_params.json'), JSON.stringify(soilJson) + '\n')
writeFileSync(join(outDir, 'gdd_stages.json'), JSON.stringify(stagesJson, null, 1) + '\n')
writeFileSync(join(outDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`soil rows: ${soilRows.length}; stage crops: ${Object.keys(crops).join(', ')}`)
