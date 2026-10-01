// Small shared helpers for the fidelity harness (no deps beyond Node 20+).
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Minimal RFC4180-ish CSV parser (handles quoted fields with commas/quotes). */
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
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '')
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

/** Run async fn over items with bounded concurrency (be polite to the API). */
export async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k], k)
    }
  })
  await Promise.all(workers)
  return out
}

export async function ensureDir(d) {
  await mkdir(d, { recursive: true })
}

export async function writeJson(path, obj) {
  await ensureDir(dirname(path))
  await writeFile(path, JSON.stringify(obj, null, 2))
}

export async function readJson(path, fallback = undefined) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (e) {
    if (fallback !== undefined) return fallback
    throw e
  }
}

/**
 * fetch with retry on 5xx/network errors only, plus an optional on-disk cache
 * (cacheFile + maxAgeMs). Returns { status, ok, text, ms, url }.
 */
export async function fetchText(url, { retries = 2, timeoutMs = 180_000, cacheFile, maxAgeMs } = {}) {
  if (cacheFile && maxAgeMs) {
    try {
      const st = await stat(cacheFile)
      if (Date.now() - st.mtimeMs < maxAgeMs) {
        return { status: 200, ok: true, text: await readFile(cacheFile, 'utf8'), ms: 0, url, cached: true }
      }
    } catch {
      /* miss */
    }
  }
  let last
  for (let a = 0; a <= retries; a++) {
    const t0 = Date.now()
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      const text = await res.text()
      last = { status: res.status, ok: res.ok, text, ms: Date.now() - t0, url }
      if (res.status < 500) break
    } catch (e) {
      last = { status: 0, ok: false, text: String(e), ms: Date.now() - t0, url }
    }
    await sleep(1000 * (a + 1))
  }
  if (cacheFile && last.ok) {
    await ensureDir(dirname(cacheFile))
    await writeFile(cacheFile, last.text)
  }
  return last
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

export function daysAgo(n, from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  return d
}

export function slug(s) {
  return String(s).replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 120)
}
