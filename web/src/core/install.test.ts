import { describe, expect, it } from 'vitest'
import { installOffer, isInstallHome, isIos, showTip, tipText } from './install'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

describe('isInstallHome', () => {
  it('is the Mesonet host’s /dash/next/ only', () => {
    expect(isInstallHome({ hostname: 'mesonet.climate.umt.edu', pathname: '/dash/next/' })).toBe(true)
    expect(isInstallHome({ hostname: 'mesonet.climate.umt.edu', pathname: '/dash/' })).toBe(false)
    expect(isInstallHome({ hostname: 'mt-climate-office.github.io', pathname: '/mesonet-dashboard/next/' })).toBe(false)
  })
})

describe('isIos', () => {
  it('finds iPhones and iPads (iPadOS reports a Mac with touch), not Macs or Android', () => {
    expect(isIos(IPHONE, 5)).toBe(true)
    expect(isIos(IPAD, 5)).toBe(true)
    expect(isIos(IPAD, 0)).toBe(false)
    expect(isIos(ANDROID, 5)).toBe(false)
  })
})

describe('installOffer', () => {
  const env = { home: true, standalone: false, canPrompt: false, ios: false }
  it('offers the browser prompt when there is one', () => expect(installOffer({ ...env, canPrompt: true })).toBe('prompt'))
  it('offers the iOS steps on iOS', () => expect(installOffer({ ...env, ios: true })).toBe('ios'))
  it('offers nothing when installed, off the install address, or not installable', () => {
    expect(installOffer({ ...env, canPrompt: true, standalone: true })).toBe('none')
    expect(installOffer({ ...env, ios: true, home: false })).toBe('none')
    expect(installOffer(env)).toBe('none')
  })
})

describe('showTip', () => {
  const ok = { phone: true, hasStation: true, dismissed: false }
  it('shows once a station is open on a phone, until dismissed', () => {
    expect(showTip('ios', ok)).toBe(true)
    expect(showTip('prompt', ok)).toBe(true)
    expect(showTip('ios', { ...ok, dismissed: true })).toBe(false)
    expect(showTip('ios', { ...ok, hasStation: false })).toBe(false)
    expect(showTip('ios', { ...ok, phone: false })).toBe(false)
    expect(showTip('none', ok)).toBe(false)
  })
  it('names the iOS steps', () => {
    expect(tipText('ios')).toMatch(/Share.*Add to Home Screen/)
    expect(tipText('prompt')).toMatch(/Install/)
  })
})
