import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { kitFiles, verified } from './kit'

describe('the kit files the tests load (test/kit.ts)', () => {
  it('are the ones index.html pins, core before photos', () => {
    const files = kitFiles()
    expect(files.map((f) => f.path)).toEqual(['core/mco-core.js', 'photos/mco-photos.js'])
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
  it('put MCO.photos on the test global', () => {
    expect(MCO.photos.PUBLIC).toEqual(['N', 'E', 'S', 'W'])
  })
})
