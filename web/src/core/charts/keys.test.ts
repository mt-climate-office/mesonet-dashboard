import { describe, expect, it } from 'vitest'
import { KEY_GAP, keyRow, keyWidth, rowWidth, wrapKeys, type KeyEntry } from './keys'
import { testCtx } from './testing'

type G = { x: number; y: number; children: { type: string; style: { text?: string; fill?: string; font?: string; lineWidth?: number } }[] }

describe('key rows', () => {
  const ctx = testCtx('dark', 900)
  const entries: KeyEntry[] = ['2026', '2025', '2024'].map((label, i) => ({ label, color: '#123456', ...(i === 0 ? { strong: true } : {}) }))

  it('lays keys left to right from `left`, each its width plus the gap after the last', () => {
    const row = keyRow(ctx, entries, 72, 18) as unknown as G[]
    expect(row.map((g) => g.x)).toEqual([72, 72 + keyWidth(ctx, entries[0]) + KEY_GAP, 72 + keyWidth(ctx, entries[0]) + keyWidth(ctx, entries[1]) + 2 * KEY_GAP])
    expect(row.every((g) => g.y === 18)).toBe(true)
    expect(rowWidth(ctx, entries)).toBe(keyWidth(ctx, entries[0]) + keyWidth(ctx, entries[1]) + keyWidth(ctx, entries[2]) + 2 * KEY_GAP)
  })
  it('a strong key: a heavier swatch and its label bold in the text color; others muted', () => {
    const [strong, plain] = keyRow(ctx, entries, 0, 0) as unknown as G[]
    expect(strong.children[0].style.lineWidth).toBe(3)
    expect(strong.children[1].style).toMatchObject({ fill: ctx.theme.text })
    expect(strong.children[1].style.font).toMatch(/^600 /)
    expect(plain.children[0].style.lineWidth).toBe(2)
    expect(plain.children[1].style.fill).toBe(ctx.theme.textMuted)
  })
  it('wraps in order onto rows no wider than the space', () => {
    const avail = keyWidth(ctx, entries[0]) + KEY_GAP + keyWidth(ctx, entries[1])
    expect(wrapKeys(ctx, entries, avail).map((r) => r.map((e) => e.label))).toEqual([['2026', '2025'], ['2024']])
    expect(wrapKeys(ctx, entries, 10_000)).toHaveLength(1)
    expect(wrapKeys(ctx, [], 100)).toEqual([])
  })
})
