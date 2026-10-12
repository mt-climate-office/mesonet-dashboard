/**
 * Kit-consumer checks (mco-web-style tools/consumer-verify.mjs + MIGRATING.md),
 * adapted to the BUILT page: dist/index.html and dist/assets/*.css are what
 * ships, so they are what is checked. Then a short browser session for the
 * runtime rules (storage keys, fonts, theme boot). Run via `npm run verify`.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, check, finish, open, start } from './lib.mjs'

const html = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8')
const head = html.slice(0, html.indexOf('</head>'))
const css = readdirSync(join(ROOT, 'dist', 'assets'))
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(ROOT, 'dist', 'assets', f), 'utf8'))
  .join('\n')
const tags = (re) => [...html.matchAll(re)].map((m) => m[0])
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? (new RegExp(`\\s${name}(\\s|>)`).test(tag) ? '' : null)

/* ── <head>: kit pin, SRI, CSP, anti-flash, viewport ───────────────────── */

const kitVersions = new Set([...html.matchAll(/mco-web-style@([^/"']+)/g)].map((m) => m[1]))
check('kit pinned to exactly one x.y.z version', kitVersions.size === 1 && /^\d+\.\d+\.\d+$/.test([...kitVersions][0]), [...kitVersions].join(', ') || 'none')

const external = [
  ...tags(/<script\b[^>]*\ssrc="https?:[^"]*"[^>]*>/g),
  ...tags(/<link\b[^>]*rel="stylesheet"[^>]*>/g).filter((t) => /href="https?:/.test(t)),
]
const noSri = external.filter((t) => !/^sha384-/.test(attr(t, 'integrity') ?? '') || attr(t, 'crossorigin') !== 'anonymous')
check(`SRI (sha384 + crossorigin=anonymous) on all ${external.length} CDN scripts/stylesheets`, external.length > 0 && noSri.length === 0, noSri.join(' | '))
const unpinned = external.filter((t) => !/@\d+\.\d+\.\d+\//.test(t))
check('every CDN script/stylesheet URL names an exact @x.y.z', unpinned.length === 0, unpinned.join(' | '))

const fonts = tags(/<link\b[^>]*rel="preload"[^>]*as="font"[^>]*>/g)
check('font preloads: crossorigin, same kit version', fonts.length >= 2 && fonts.every((t) => attr(t, 'crossorigin') !== null && t.includes(`@${[...kitVersions][0]}/`)), fonts.join(' | '))

const csp = head.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1]?.replace(/\s+/g, ' ') ?? ''
check('meta CSP present with default-src \'none\'', csp.includes("default-src 'none'"))
const inline = [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
const missing = inline.filter((body) => !csp.includes(`'sha256-${createHash('sha256').update(body).digest('base64')}'`))
check(`CSP script-src hashes every inline <head> script (${inline.length})`, inline.length > 0 && missing.length === 0, `${missing.length} unhashed`)

const antiFlash = inline.find((b) => b.includes("setAttribute('data-theme'"))
const firstSheet = head.search(/<link\b[^>]*rel="stylesheet"/)
check('anti-flash script: inline, before the first stylesheet, reads mco-theme',
  !!antiFlash && head.indexOf(antiFlash) < firstSheet && antiFlash.includes("'mco-theme'"))
check('viewport meta has viewport-fit=cover', /<meta name="viewport" content="[^"]*viewport-fit=cover/.test(head))
check('<html lang> and a non-empty <title>', /<html lang="[a-z-]+"/.test(html) && /<title>[^<]+<\/title>/.test(head))

/* ── Skip link and focus rules ──────────────────────────────────────────── */

const body = html.slice(html.indexOf('<body>') + 6).replace(/<!--[\s\S]*?-->/g, '').trimStart()
check('skip link is the first element in <body> and targets #main', /^<a class="mco-skip-link" href="#main">/.test(body))
check('<main id="main" tabindex="-1"> exists', /<main id="main" tabindex="-1">/.test(html))
// HOUSE-STYLE §5.4: no per-selector focus rules, no focus kills. The allowed
// exceptions are focus targets that are not controls: the skip-link target itself
// (family convention: mesonet-status) and headings with tabindex="-1" (styles/app.css).
const TARGET = /^(main|:is\(h1,\s*h2,\s*h3\)\[tabindex="?-1"?\]):focus$/
// The minifier may merge the two into one selector list.
const isTarget = (sel) => sel.split(/,(?![^(]*\))/).every((p) => TARGET.test(p.trim()))
const focusRules = [...css.matchAll(/([^{}]*:focus[^{]*)\{([^}]*)\}/g)].map((m) => [m[1].trim(), m[2].trim()])
const badFocus = focusRules.filter(([sel, body]) => !(isTarget(sel) && /^outline:\s*none;?$/.test(body))).map(([s, b]) => `${s}{${b}}`)
check('app CSS: no per-selector :focus rules (only the focus targets: main, headings with tabindex=-1)', badFocus.length === 0, badFocus.join(' | '))
const kills = [...css.matchAll(/([^{}]*)\{[^}]*outline:\s*(none|0)\b[^}]*\}/g)].map((m) => m[1].trim()).filter((s) => !isTarget(s))
check('app CSS: no outline:none / outline:0', kills.length === 0, kills.join(' | '))

/* ── Runtime: storage keys, fonts, theme boot ───────────────────────────── */

const env = await start()
{
  const { page, close, rendered, problems } = await open(env, '?s=acebozem&theme=light#latest')
  await rendered({ charts: 1 })
  check('?theme=light boots data-theme=light before app code', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light')
  // Exercise what persists: the theme (header ⋯ menu), a section switch and the station picker (drawer + station memory).
  await page.getByTestId('header-menu-button').click()
  await page.getByTestId('menu-theme').click()
  await page.waitForFunction(() => localStorage.getItem('mco-theme') === 'high-contrast')
  await page.keyboard.press('Escape')
  await page.locator('[data-testid="section-row"] a[data-section="about"]').click()
  await page.waitForFunction(() => location.hash === '#about')
  await page.getByTestId('station-switcher').click()
  await page.waitForFunction(() => localStorage.getItem('mco-dashboard-drawer') === 'open')
  const keys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)])
  const bad = keys.filter((k) => !k.startsWith('mco-'))
  check(`storage keys are mco-* (${keys.join(', ') || 'none'})`, bad.length === 0, bad.join(', '))
  const fontState = await page.evaluate(async () => {
    await document.fonts.ready
    return ['Outfit', 'Space Mono'].map((f) => [...document.fonts].some((ff) => ff.family.replace(/"/g, '') === f && ff.status === 'loaded'))
  })
  check('house fonts Outfit + Space Mono loaded from the kit', fontState.every(Boolean), JSON.stringify(fontState))
  const p = await problems()
  check('consumer session: console + CSP clean', p.length === 0, p.slice(0, 4).join(' | '))
  await close()
}
await env.close()
finish('consumer')
