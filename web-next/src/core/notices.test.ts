import { describe, expect, it } from 'vitest'
import {
  LEGACY_SATELLITE_URL,
  legacyStateNotice,
  satelliteNotice,
  stationResolvedMessage,
} from './notices'

describe('legacyStateNotice', () => {
  it('links the saved layout on the legacy dashboard', () => {
    const n = legacyStateNotice('abcd1234')
    expect(n.id).toBe('legacy-state')
    expect(n.href).toBe('https://mesonet.climate.umt.edu/dash/?state=abcd1234')
    expect(n.toast).not.toMatch(/https?:/)
  })
  it('encodes odd hashes', () => {
    expect(legacyStateNotice('a&b').href).toBe('https://mesonet.climate.umt.edu/dash/?state=a%26b')
  })
})

describe('satelliteNotice', () => {
  it('links the legacy satellite view', () => {
    expect(LEGACY_SATELLITE_URL).toBe('https://mesonet.climate.umt.edu/dash#satellite')
    expect(satelliteNotice().href).toBe(LEGACY_SATELLITE_URL)
  })
})

describe('stationResolvedMessage', () => {
  const row = { station: 'acebozem', name: 'Bozeman' }
  it('names the raw id and the station it resolved to', () => {
    expect(stationResolvedMessage('KEEM8', row)).toBe('Station KEEM8 opened as Bozeman (acebozem).')
    expect(stationResolvedMessage(' ACEBOZEM ', row)).toBe('Station ACEBOZEM opened as Bozeman (acebozem).')
  })
  it('is null when nothing was rewritten or nothing matched', () => {
    expect(stationResolvedMessage('acebozem', row)).toBeNull()
    expect(stationResolvedMessage(null, row)).toBeNull()
    expect(stationResolvedMessage('nope', undefined)).toBeNull()
  })
})
