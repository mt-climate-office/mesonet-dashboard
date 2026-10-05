#!/usr/bin/env node
/**
 * Regenerates the vendored Ag static data in `web-next/public/data/`:
 *
 *   soil_params.json  ← mesonet-soils soil_params.json (copied verbatim; the
 *                       same file data2 serves at soils/soil_params.json)
 *   gdd_stages.json   ← mesonet-db-rds derived/{combined_stages.tsv,
 *                       write_hemp_table.sql}
 *   MANIFEST.json     provenance (source repo, path, commit SHA, capture date)
 *
 * Usage (from web-next/):
 *   node src/core/ag/data/vendor-static.mjs \
 *     --soils ../../mesonet-soils --rds ../../mesonet-db-rds
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
const rdsRepo = resolve(arg('rds', join(webRoot, '../../mesonet-db-rds')))

const gitSha = (repo) =>
  execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const gitDirty = (repo, path) =>
  execFileSync('git', ['-C', repo, 'status', '--porcelain', '--', path], {
    encoding: 'utf8',
  }).trim() !== ''

const readCsv = (p, delimiter = ',') =>
  Papa.parse(readFileSync(p, 'utf8'), { header: true, skipEmptyLines: true, delimiter }).data

/* ---------------------------------------------------------------- soils */
// mesonet-soils publishes the app's contract directly: copy it byte for byte.
const soilText = readFileSync(join(soilsRepo, 'soil_params.json'), 'utf8')
const soilJson = JSON.parse(soilText)

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
  generated_by: 'web-next/src/core/ag/data/vendor-static.mjs',
  captured_at: today,
  files: {
    'soil_params.json': {
      source_repo: 'mt-climate-office/mesonet-soils',
      source_paths: ['soil_params.json'],
      source_commit: gitSha(soilsRepo),
      source_dirty: gitDirty(soilsRepo, 'soil_params.json'),
      release: soilJson.release,
      rows: soilJson.rows.length,
      transform: 'None (copied verbatim). One row per primary core (station, depthCm); see the mesonet-soils README.',
      data2_url: 'https://data2.climate.umt.edu/mesonet/soils/soil_params.json',
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
writeFileSync(join(outDir, 'soil_params.json'), soilText)
writeFileSync(join(outDir, 'gdd_stages.json'), JSON.stringify(stagesJson, null, 1) + '\n')
// Keep entries other scripts own (places.json: core/places/vendor-places.mjs).
const previous = JSON.parse(readFileSync(join(outDir, 'MANIFEST.json'), 'utf8'))
manifest.files = { ...previous.files, ...manifest.files }
writeFileSync(join(outDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`soil rows: ${soilJson.rows.length} (${soilJson.release}); stage crops: ${Object.keys(crops).join(', ')}`)
