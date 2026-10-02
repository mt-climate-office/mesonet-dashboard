// Bundle-size gate (CI: web-next-check). Run after `npm run build`.
// Budgets are gzip bytes; see ARCHITECTURE.md § Bundle budget for why.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const KB = 1024
const ENTRY_BUDGET = 200 * KB // the chunk index.html loads first
const TOTAL_BUDGET = 450 * KB // every JS chunk, lazy ones included

const dir = new URL('../dist/', import.meta.url).pathname
const html = readFileSync(join(dir, 'index.html'), 'utf8')
const entry = /<script type="module"[^>]*src="[^"]*\/(assets\/[^"]+\.js)"/.exec(html)?.[1]
if (!entry) throw new Error('check-size: no module entry in dist/index.html')

const gz = (f) => gzipSync(readFileSync(join(dir, f))).length
const chunks = readdirSync(join(dir, 'assets')).filter((f) => f.endsWith('.js')).map((f) => `assets/${f}`)
const entryGz = gz(entry)
const totalGz = chunks.reduce((sum, f) => sum + gz(f), 0)

const fmt = (b) => `${(b / KB).toFixed(1)} KB`
console.log(`entry ${entry}: ${fmt(entryGz)} gzip (budget ${fmt(ENTRY_BUDGET)})`)
console.log(`all JS (${chunks.length} chunks): ${fmt(totalGz)} gzip (budget ${fmt(TOTAL_BUDGET)})`)
if (entryGz > ENTRY_BUDGET || totalGz > TOTAL_BUDGET) {
  console.error('check-size: over budget')
  process.exit(1)
}
