// Small shared helpers for the fidelity harness (Node 20+, no dependencies).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Minimal RFC 4180 CSV parser (quoted fields with commas/quotes). Rows as objects keyed by header. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else q = false
      } else field += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header = [], ...body] = rows.filter((r) => r.length > 1 || r[0] !== '')
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

export async function ensureDir(d) {
  await mkdir(d, { recursive: true })
}

export async function writeJson(path, obj) {
  await ensureDir(dirname(path))
  await writeFile(path, JSON.stringify(obj, null, 1))
}

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (e) {
    if (fallback !== undefined) return fallback
    throw e
  }
}

/** fetch text with retries on 5xx/network errors only. Returns { status, ok, text, ms, url }. */
export async function fetchText(url, { retries = 2, timeoutMs = 180_000 } = {}) {
  let last
  for (let a = 0; a <= retries; a++) {
    const t0 = Date.now()
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      last = { status: res.status, ok: res.ok, text: await res.text(), ms: Date.now() - t0, url }
      if (res.status < 500) break
    } catch (e) {
      last = { status: 0, ok: false, text: String(e), ms: Date.now() - t0, url }
    }
    await sleep(1500 * (a + 1))
  }
  return last
}

/** Today's date (YYYY-MM-DD) in Mountain Time, minus `n` days. Not UTC: the apps' "today" is Denver's. */
export function mtDate(n = 0) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
  const ms = Date.parse(`${today}T12:00:00Z`) - n * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** YYYY-MM-DD + n days. */
export const addDays = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export const slug = (s) => String(s).replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 120)

export const sha256 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

/** DOCUMENTED: compared content differs on purpose, citing a DIVERGENCES entry; no value difference. */
const RANK = { PASS: 0, DOCUMENTED: 1, WARN: 2, FAIL: 3, ERROR: 4 }
/** The worst of any number of statuses (or arrays of them). */
export const worst = (...s) => s.flat().reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'PASS')
