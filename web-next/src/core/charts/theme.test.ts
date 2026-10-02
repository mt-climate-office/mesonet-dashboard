import { describe, expect, it } from 'vitest'
import { INDEX_LINE, NORMALS } from '../palette'
import { TOKENS_SNAPSHOT } from '../palette/tokens.snapshot'
import { echartsTheme, paint, readChartTheme } from './theme'
import { fakeGetVar } from './testing'

describe('readChartTheme', () => {
  it('reads every chrome token and the palette vars, trimmed', () => {
    const t = readChartTheme('light', (n) => ` ${fakeGetVar('light')(n)} `)
    expect(t).toMatchObject({
      name: 'light',
      text: '#1a1a2e',
      textMuted: '#3a3f4b',
      grid: '#c8cdd5',
      surface: '#ffffff',
      tooltipBorder: '#1563a0',
    })
    expect(t.fontMono).toContain('Space Mono')
    expect(t.vars['--text-dim']).toBe(TOKENS_SNAPSHOT.light['--text-dim'])
  })

  it('missing tokens become empty strings', () => {
    expect(readChartTheme('dark', () => '').text).toBe('')
  })
})

describe('paint', () => {
  it('resolves palette TokenRefs from the theme vars, with alpha', () => {
    const t = readChartTheme('dark', fakeGetVar('dark'))
    expect(paint(t, INDEX_LINE)).toBe('#8494ab')
    expect(paint(t, NORMALS.band)).toBe('rgba(132,148,171,0.18)')
    expect(paint(t, '#123456')).toBe('#123456')
  })
})

describe('echartsTheme', () => {
  it('is chrome only: transparent background, token colors, mono numbers, UI names', () => {
    const t = readChartTheme('high-contrast', fakeGetVar('high-contrast'))
    const e = echartsTheme(t) as Record<string, Record<string, Record<string, unknown>>>
    expect(e.backgroundColor).toBe('transparent')
    expect(e.color).toBeUndefined()
    expect(e.textStyle).toEqual({ color: '#ffffff', fontFamily: t.fontUi })
    expect(e.valueAxis.axisLabel).toMatchObject({ color: '#f5f5f5', fontFamily: t.fontMono })
    expect(e.timeAxis.nameTextStyle).toMatchObject({ fontFamily: t.fontUi })
    expect(e.categoryAxis.axisLabel).toMatchObject({ fontFamily: t.fontUi })
    expect(e.tooltip).toMatchObject({ backgroundColor: 'rgba(0,0,0,0.96)', borderColor: '#93d0ff' })
  })
})
