// Side-by-side screenshot comparison with the legacy dashboard.
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'audit-screens')

const STATION = process.argv[2] ?? 'acebozem'

await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

// Legacy
const legacyPage = await ctx.newPage()
console.log(`Loading legacy dashboard for ${STATION}...`)
await legacyPage.goto(`https://mesonet.climate.umt.edu/dash/${STATION}/`, {
  waitUntil: 'networkidle',
  timeout: 60000,
})
await legacyPage.waitForTimeout(5000)
await legacyPage.screenshot({ path: join(OUT_DIR, 'legacy.png'), fullPage: false })
console.log('Legacy screenshot saved.')

// New
const newPage = await ctx.newPage()
console.log(`Loading new dashboard for ${STATION}...`)
await newPage.goto(`http://localhost:5173/mesonet-dashboard/?s=${STATION}`, {
  waitUntil: 'networkidle',
})
await newPage.waitForTimeout(3500)
await newPage.screenshot({ path: join(OUT_DIR, 'new.png'), fullPage: false })
console.log('New dashboard screenshot saved.')

await browser.close()
