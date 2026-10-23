import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { kitData, kitDataFiles, kitFiles, verified } from './kit'

describe('the kit files the tests load (test/kit.ts)', () => {
  it('are the ones index.html pins, core first', () => {
    const files = kitFiles()
    expect(files.map((f) => f.path)).toEqual(['core/mco-core.js', 'photos/mco-photos.js', 'places/mco-places.js', 'summary/mco-summary.js'])
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    for (const f of files) expect(html).toContain(`<script src="${f.url}"\n          integrity="${f.integrity}"`)
  })
  it('are checked against their SRI: the cached bytes pass, one changed byte fails', () => {
    for (const f of kitFiles()) {
      const bytes = readFileSync(f.cachePath)
      expect(() => verified(f, bytes)).not.toThrow()
      const bad = Buffer.from(bytes)
      bad[bad.length - 1] ^= 1
      expect(() => verified(f, bad)).toThrow(/integrity mismatch/)
    }
  })
  it('put MCO.photos, MCO.places and MCO.summary on the test global', () => {
    expect(MCO.photos.PUBLIC).toEqual(['N', 'E', 'S', 'W'])
    expect(MCO.places.RESULTS).toBe(8)
    expect(MCO.summary.CALM_MPH).toBe(1)
  })
  it('fetch the gazetteer from the same tag, checked against the hash mco-places.js carries', () => {
    const [f] = kitDataFiles()
    expect(f.url).toBe(kitFiles()[2].url.replace('places/mco-places.js', 'places/mt-places.json'))
    expect(f.integrity).toBe(MCO.places.DATA_INTEGRITY)
    expect(JSON.parse(kitData('places/mt-places.json')).rows.length).toBeGreaterThan(900)
  })
})
