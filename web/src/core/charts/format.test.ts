import { describe, expect, it } from 'vitest'
import { escapeHtml, fmtNum, fmtWall, isoWall, plainLabel, wallMs } from './format'

describe('format', () => {
  it('plainLabel converts Plotly markup', () => {
    expect(plainLabel('<b>Reference ET<br>(a=0.23) [in]</b>')).toBe('Reference ET\n(a=0.23) [in]')
    expect(plainLabel('Solar [W m<sup>-2</sup>]')).toBe('Solar [W m⁻²]')
  })
  it('wallMs: local strings → wall-clock ms; daily rows at noon', () => {
    expect(wallMs('2025-07-01')).toBe(Date.UTC(2025, 6, 1, 12))
    expect(wallMs('2025-07-01T14:00')).toBe(Date.UTC(2025, 6, 1, 14))
    expect(() => wallMs('nope')).toThrow()
  })
  it('formats wall-clock times and numbers', () => {
    const ms = Date.UTC(2025, 6, 1, 14, 5)
    expect(fmtWall(ms, 'daily')).toBe('Jul 1, 2025')
    expect(fmtWall(ms, 'hourly')).toBe('Jul 1, 2025 14:05')
    expect(isoWall(ms, 'hourly')).toBe('2025-07-01 14:05')
    expect(fmtNum(null, 2)).toBe('—')
    expect(fmtNum(1.234, 1)).toBe('1.2')
    expect(escapeHtml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;')
  })
})
