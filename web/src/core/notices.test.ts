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
  const catalog = [
    { station: 'acebozem', name: 'Bozeman', nwsli_id: 'BZMM8' },
    { station: 'aceabsar', name: 'Absarokee', nwsli_id: null },
  ]
  it('names the raw id and the station it resolved to', () => {
    expect(stationResolvedMessage('BZMM8', catalog)).toBe('Station BZMM8 opened as Bozeman (acebozem).')
    expect(stationResolvedMessage('bzmm8', catalog)).toBe('Station bzmm8 opened as Bozeman (acebozem).')
    expect(stationResolvedMessage(' ACEBOZEM ', catalog)).toBe('Station ACEBOZEM opened as Bozeman (acebozem).')
  })
  it('is null when s was not rewritten', () => {
    expect(stationResolvedMessage('acebozem', catalog)).toBeNull()
    expect(stationResolvedMessage(null, catalog)).toBeNull()
    // A typo resolves to nothing; a later manual pick must not be "announced" as it.
    expect(stationResolvedMessage('typo', catalog)).toBeNull()
    // Catalog failed or not loaded.
    expect(stationResolvedMessage('BZMM8', undefined)).toBeNull()
  })
})
