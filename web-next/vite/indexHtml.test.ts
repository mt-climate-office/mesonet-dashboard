/**
 * Guards for index.html: the CSP's sha256 matches the inline anti-flash
 * script byte for byte, every kit tag is pinned with SRI, and @include
 * expands every partial.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { expandIncludes } from './include'

const root = fileURLToPath(new URL('..', import.meta.url))
const html = readFileSync(resolve(root, 'index.html'), 'utf8')

describe('index.html', () => {
  it('CSP pins the exact anti-flash script', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]
    const hash = `sha256-${createHash('sha256').update(script).digest('base64')}`
    const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)![1]
    expect(csp).toContain(`'${hash}'`)
  })

  it('pins every kit and MapLibre tag with integrity + crossorigin', () => {
    const tags = html.match(/<(?:link|script)[^>]+(?:mco-web-style@|maplibre-gl@)[^>]*>/g) ?? []
    const pinned = tags.filter((t) => !t.includes('rel="preload"') && !t.includes('rel="icon"') && !t.includes('apple-touch-icon'))
    expect(pinned.length).toBe(5)
    for (const t of pinned) {
      expect(t).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/)
      expect(t).toContain('crossorigin="anonymous"')
      expect(t).not.toContain('@latest')
    }
    const versions = new Set([...html.matchAll(/mco-web-style@([\d.]+)/g)].map((m) => m[1]))
    expect([...versions]).toEqual(['0.7.1'])
  })

  it('expands every @include', () => {
    const out = expandIncludes(html, root)
    expect(out).not.toMatch(/@include/)
    for (const s of ['now', 'charts', 'about']) expect(out).toContain(`id="section-${s}"`)
    expect(out).toContain('id="sheet-download"')
    // Each section's partial (and its nested includes) made it into the page.
    expect(out).toContain('x-data="nowView')
    expect(out).toContain('x-data="variablePage')
    expect(out).toContain('x-data="compareControls')
    expect(out).toContain('x-data="agTab')
    expect(out).toContain('x-data="downloader')
    expect(out).toContain('x-data="stationPicker')
  })
})
