/**
 * Test-only adapters: parse the Wave 0 golden fixture CSVs (API column names,
 * US units, `YYYY-MM-DD HH:mm:ss±hh:mm` datetimes) into contract shapes (SI,
 * America/Denver local ISO strings, null for missing).
 *
 * Fixtures are bundled through Vite's `import.meta.glob(..., '?raw')`, so no
 * Node APIs are needed and `tsc` sees only `vite/client` types.
 */
import Papa from 'papaparse'
import type {
  DailyMet,
  GddCrop,
  GddStage,
  GddStageTable,
  HourlyMet,
  Nullable,
  SoilParams,
  SoilSeries,
  StationMeta,
} from '../contract'
import { fToC, mphToMs } from '../compute/units'

const RAW = import.meta.glob(['../__fixtures__/*.csv', './*.csv'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const MANIFEST = import.meta.glob('../__fixtures__/manifest.json', {
  import: 'default',
  eager: true,
}) as Record<string, { files: Record<string, { rows?: number; error?: string }> }>

export const manifest = Object.values(MANIFEST)[0]

/** True if the fixture was captured (the API answered 200). */
export function hasFixture(name: string): boolean {
  return `../__fixtures__/${name}` in RAW
}

export function fixtureText(name: string): string {
  const text = RAW[`../__fixtures__/${name}`] ?? RAW[`./${name}`]
  if (text == null) throw new Error(`fixture not found: ${name}`)
  return text
}

export type Row = Record<string, string>

/** Parse a CSV to string records; lines starting with `#` are comments. */
export function parseRows(text: string): Row[] {
  const body = text
    .split(/\r?\n/)
    .filter((l) => !l.startsWith('#'))
    .join('\n')
  return Papa.parse<Row>(body, { header: true, skipEmptyLines: true }).data
}

export function rows(name: string): Row[] {
  return parseRows(fixtureText(name))
}

export function num(s: string | undefined): Nullable {
  if (s == null || s === '' || s === 'nan' || s === 'NaN') return null
  const v = Number(s)
  return Number.isFinite(v) ? v : null
}

export interface ParsedTime {
  /** `YYYY-MM-DD` */
  date: string
  /** `YYYY-MM-DDTHH:mm` */
  local: string
  epochMs: number
}

/** `"2025-07-01 00:00:00-06:00"` → local strings + epoch. */
export function parseApiDatetime(s: string): ParsedTime {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}([+-]\d{2}:\d{2})$/.exec(s)
  if (!m) throw new Error(`bad datetime ${s}`)
  return { date: m[1], local: `${m[1]}T${m[2]}`, epochMs: Date.parse(`${m[1]}T${m[2]}:00${m[3]}`) }
}

/** Find the single column whose name matches `re`. */
export function col(row: Row, re: RegExp): string {
  const hits = Object.keys(row).filter((k) => re.test(k))
  if (hits.length !== 1) throw new Error(`column ${re} matched ${JSON.stringify(hits)}`)
  return hits[0]
}

export function optCol(row: Row, re: RegExp): string | null {
  const hits = Object.keys(row).filter((k) => re.test(k))
  return hits.length === 1 ? hits[0] : null
}

function column(rs: Row[], re: RegExp, conv: (x: Nullable) => Nullable = (x) => x): Nullable[] {
  if (rs.length === 0) return []
  const c = optCol(rs[0], re)
  return rs.map((r) => (c == null ? null : conv(num(r[c]))))
}

export type Window = 'season2025' | 'winter2526' | 'jul2025' | 'jan2026'

/* ------------------------------------------------------------------------ */
/* Stations                                                                   */
/* ------------------------------------------------------------------------ */

export function stationMeta(id: string): StationMeta {
  const r = rows('stations.csv').find((x) => x.station === id)
  if (!r) throw new Error(`station ${id} not in stations.csv`)
  const elements = rows(`${id}.elements.csv`).map((e) => e.element)
  const windHeightM = elements.includes('wind_spd_1000')
    ? 10
    : elements.includes('wind_spd_0244')
      ? 2.44
      : null
  if (windHeightM == null) throw new Error(`no wind element for ${id}`)
  return {
    id,
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    elevationM: Number(r.elevation),
    network: r.sub_network as StationMeta['network'],
    windHeightM,
    hasSwp: r.has_swp === 'True',
    installed: r.date_installed,
  }
}

/* ------------------------------------------------------------------------ */
/* Met                                                                        */
/* ------------------------------------------------------------------------ */

export function dailyMet(station: string, window: Window): DailyMet {
  const rs = rows(`${station}.daily.${window}.obs-met.csv`)
  const t = rs.map((r) => parseApiDatetime(r.datetime))
  return {
    station,
    level: 2,
    provisional: rs.map((r) => r.provisional === 'True'),
    date: t.map((x) => x.date),
    tminC: column(rs, /^Minimum Air Temperature @/, fToC),
    tmaxC: column(rs, /^Maximum Air Temperature @/, fToC),
    tavgC: column(rs, /^Average Air Temperature @/, fToC),
    rhMin: column(rs, /^Minimum Relative Humidity/),
    rhMax: column(rs, /^Maximum Relative Humidity/),
    rhAvg: column(rs, /^Average Relative Humidity/),
    sradWm2: column(rs, /^Average Solar Radiation/),
    windMs: column(rs, /^Average Wind Speed @/, mphToMs),
  }
}

export function hourlyMet(station: string, window: Window): HourlyMet {
  const rs = rows(`${station}.hourly.${window}.obs-met.csv`)
  const t = rs.map((r) => parseApiDatetime(r.datetime))
  return {
    station,
    level: 2,
    provisional: rs.map((r) => r.provisional === 'True'),
    time: t.map((x) => x.local),
    epochMs: t.map((x) => x.epochMs),
    tC: column(rs, /^Average Air Temperature @/, fToC),
    rh: column(rs, /^Average Relative Humidity/),
    sradWm2: column(rs, /^Average Solar Radiation/),
    windMs: column(rs, /^Average Wind Speed @/, mphToMs),
  }
}

/* ------------------------------------------------------------------------ */
/* Soil                                                                       */
/* ------------------------------------------------------------------------ */

export function soilSeries(station: string, period: 'daily' | 'hourly', window: Window): SoilSeries {
  const rs = rows(`${station}.${period}.${window}.obs-soil.csv`)
  const t = rs.map((r) => parseApiDatetime(r.datetime))
  const depths = [
    ...new Set(
      Object.keys(rs[0])
        .map((k) => /^Average Soil VWC @ -(\d+) cm/.exec(k)?.[1])
        .filter((x): x is string => x != null)
        .map(Number),
    ),
  ].sort((a, b) => a - b)
  return {
    station,
    level: 2,
    provisional: rs.map((r) => r.provisional === 'True'),
    depthsCm: depths,
    time: t.map((x) => (period === 'daily' ? x.date : x.local)),
    epochMs: t.map((x) => x.epochMs),
    vwcPct: depths.map((d) => column(rs, new RegExp(`^Average Soil VWC @ -${d} cm`))),
    tempC: depths.map((d) => column(rs, new RegExp(`^Average Soil Temperature @ -${d} cm`), fToC)),
  }
}

/**
 * Soil parameters for tests: FX params and porosity from the vendored
 * mesonet-soils release copied into `__fixtures__/soil_params.test.csv`, plus
 * the lab VWC clip range from `<station>.soil-raw.csv` (the API's
 * `/derived/swp` raw lab table; min/max VWC per depth, as fractions).
 */
export function soilParams(station: string): SoilParams[] {
  const table = rows('soil_params.test.csv').filter((r) => r.station === station)
  const raw = hasFixture(`${station}.soil-raw.csv`) ? rows(`${station}.soil-raw.csv`) : []
  return table.map((r) => {
    const depthCm = Number(r.depth_cm)
    const lab = raw.filter((x) => Number(x['Depth [cm]']) === depthCm).map((x) => Number(x.VWC))
    const p: SoilParams = {
      station,
      depthCm,
      model: 'FX',
      porosityPct: num(r.porosity) ?? undefined,
      source: 'vendored',
      release: r.release,
    }
    if (r.r !== '') {
      p.fx = { r: Number(r.r), s: Number(r.s), n: Number(r.n), m: Number(r.m), h: Number(r.h) }
    }
    if (lab.length > 0) {
      p.labVwcMin = Math.min(...lab) * 100
      p.labVwcMax = Math.max(...lab) * 100
    }
    return p
  })
}

/* ------------------------------------------------------------------------ */
/* GDD stage tables (test copy; B vendors the real ones)                      */
/* ------------------------------------------------------------------------ */

export function stageTable(crop: GddCrop): GddStageTable {
  const stages: GddStage[] = rows('gdd_stages.test.csv')
    .filter((r) => r.crop === crop && r.gdds !== 'NA' && r.gdds !== '')
    .map((r) => {
      const n = Number(r.stage)
      return {
        stage: r.stage !== '' && Number.isFinite(n) ? n : r.stage,
        name: r.name === 'NA' || r.name === '' ? null : r.name,
        description: null,
        gdd: Number(r.gdds),
      }
    })
  return { crop, stages }
}
