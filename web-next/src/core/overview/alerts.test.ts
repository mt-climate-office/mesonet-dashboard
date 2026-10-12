import { describe, expect, it } from 'vitest'
import type { NwsAlert } from '../api'
import { alertBanners, alertTone, alertWhen } from './alerts'

// Mon Oct 12 2026, 10 AM Denver wall clock.
const NOW = Date.UTC(2026, 9, 12, 10)
const at = (day: number, h: number, m = 0) => Date.UTC(2026, 9, day, h, m)
const alert = (p: Partial<NwsAlert>): NwsAlert => ({
  id: p.event ?? 'x',
  event: 'Winter Storm Warning',
  headline: '',
  severity: 'Moderate',
  onset: at(12, 6),
  ends: at(13, 18),
  description: '',
  instruction: '',
  ...p,
})

describe('alertTone', () => {
  it('warnings red, watches and advisories amber, statements info; Extreme or Severe always red', () => {
    expect(alertTone({ event: 'Red Flag Warning', severity: 'Moderate' })).toBe('danger')
    expect(alertTone({ event: 'Winter Storm Watch', severity: 'Moderate' })).toBe('warning')
    expect(alertTone({ event: 'Wind Advisory', severity: 'Minor' })).toBe('warning')
    expect(alertTone({ event: 'Special Weather Statement', severity: 'Minor' })).toBe('info')
    expect(alertTone({ event: 'Special Weather Statement', severity: 'Severe' })).toBe('danger')
  })
})

describe('alertWhen', () => {
  it('in effect: until the end, "today" on the same day; minutes and noon in words', () => {
    expect(alertWhen({ onset: at(12, 6), ends: at(13, 18) }, NOW)).toBe('until 6 PM Tue')
    expect(alertWhen({ onset: null, ends: at(12, 18) }, NOW)).toBe('until 6 PM today')
    expect(alertWhen({ onset: null, ends: at(13, 6, 30) }, NOW)).toBe('until 6:30 AM Tue')
    expect(alertWhen({ onset: null, ends: at(14, 12) }, NOW)).toBe('until noon Wed')
    expect(alertWhen({ onset: null, ends: at(14, 0) }, NOW)).toBe('until 12 AM Wed')
  })
  it('not yet started: from … until …; no end: the start alone, or nothing', () => {
    expect(alertWhen({ onset: at(12, 18), ends: at(13, 12) }, NOW)).toBe('from 6 PM today until noon Tue')
    expect(alertWhen({ onset: at(13, 0), ends: at(13, 9) }, NOW)).toBe('from 12 AM until 9 AM Tue')
    expect(alertWhen({ onset: at(13, 6, 30), ends: at(13, 9) }, NOW)).toBe('from 6:30 AM until 9 AM Tue')
    expect(alertWhen({ onset: at(13, 3), ends: null }, NOW)).toBe('from 3 AM Tue')
    expect(alertWhen({ onset: null, ends: null }, NOW)).toBe('')
  })
})

describe('alertBanners', () => {
  it('drops ended alerts; danger first, then by start', () => {
    const banners = alertBanners(
      [
        alert({ event: 'Wind Advisory', onset: at(12, 8) }),
        alert({ event: 'Winter Storm Warning', onset: at(12, 18) }),
        alert({ event: 'Frost Advisory', onset: at(12, 2) }),
        alert({ event: 'Red Flag Warning', ends: at(12, 9) }),
      ],
      NOW,
    )
    expect(banners.map((b) => [b.event, b.tone])).toEqual([
      ['Winter Storm Warning', 'danger'],
      ['Frost Advisory', 'warning'],
      ['Wind Advisory', 'warning'],
    ])
    expect(banners[0].when).toBe('from 6 PM today until 6 PM Tue')
  })
  it('nothing before the alerts load', () => {
    expect(alertBanners(undefined, NOW)).toEqual([])
  })
})
