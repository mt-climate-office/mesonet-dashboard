import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_OUTAGE_CONFIG,
  coerceOutageConfig,
  fetchOutageConfig,
  outageTone,
  outageStorageKey,
  OUTAGE_TONE_LABELS,
  claimOutage,
} from './outage'

describe('coerceOutageConfig', () => {
  it('falls back to defaults for non-objects', () => {
    expect(coerceOutageConfig(null)).toEqual(DEFAULT_OUTAGE_CONFIG)
    expect(coerceOutageConfig([1, 2])).toEqual(DEFAULT_OUTAGE_CONFIG)
    expect(coerceOutageConfig('x')).toEqual(DEFAULT_OUTAGE_CONFIG)
  })
  it('merges over defaults and ignores nulls', () => {
    expect(
      coerceOutageConfig({ active: true, id: 7, message: 'Down', title: null, extra: 1 }),
    ).toEqual({
      active: true,
      id: '7',
      title: 'Montana Mesonet Notice',
      color: 'warning',
      message: 'Down',
      button_text: 'Got it',
    })
  })
  it('forces inactive when the message is blank', () => {
    expect(coerceOutageConfig({ active: true, message: '   ' }).active).toBe(false)
    expect(coerceOutageConfig({ active: true }).active).toBe(false)
  })
  it('respects active=false', () => {
    expect(coerceOutageConfig({ active: false, message: 'x' }).active).toBe(false)
  })
})

describe('outageTone', () => {
  it('maps bootstrap names', () => {
    expect(outageTone('warning')).toBe('warning')
    expect(outageTone(' Danger ')).toBe('danger')
    expect(outageTone('primary')).toBe('info')
    expect(outageTone('success')).toBe('success')
    expect(outageTone('secondary')).toBe('neutral')
  })
  it('defaults to warning', () => {
    expect(outageTone('nonsense')).toBe('warning')
  })
})

describe('outageStorageKey', () => {
  it('is app-prefixed per notice id', () => {
    expect(outageStorageKey('2026-08-13-partial-outage')).toBe(
      'mco-dashboard-outage-2026-08-13-partial-outage',
    )
  })
})

describe('OUTAGE_TONE_LABELS', () => {
  it('names every tone in words', () => {
    for (const t of ['warning', 'danger', 'info', 'success', 'neutral'] as const) {
      expect(OUTAGE_TONE_LABELS[t]).toMatch(/^[A-Z][a-z]+$/)
    }
  })
})

describe('claimOutage', () => {
  const memory = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
  }
  const on = coerceOutageConfig({ active: true, id: 'a', message: 'Down' })

  it('shows an active notice once per id', () => {
    const s = memory()
    expect(claimOutage(on, s)).toBe(true)
    expect(s.m.get('mco-dashboard-outage-a')).toBe('1')
    expect(claimOutage(on, s)).toBe(false)
    expect(claimOutage({ ...on, id: 'b' }, s)).toBe(true)
  })
  it('never shows an inactive notice or writes a flag for it', () => {
    const s = memory()
    expect(claimOutage(DEFAULT_OUTAGE_CONFIG, s)).toBe(false)
    expect(claimOutage({ ...on, active: false }, s)).toBe(false)
    expect(s.m.size).toBe(0)
  })
  it('shows when storage is missing or throws', () => {
    expect(claimOutage(on, null)).toBe(true)
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(claimOutage(on, broken)).toBe(true)
  })
})

describe('fetchOutageConfig', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the coerced config', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ active: true, id: 'a', message: 'm' }))),
    )
    expect((await fetchOutageConfig('u')).active).toBe(true)
  })
  it('is inactive on HTTP errors, network errors and bad JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    expect((await fetchOutageConfig('u')).active).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    expect((await fetchOutageConfig('u')).active).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{not json')))
    expect((await fetchOutageConfig('u')).active).toBe(false)
  })
  it('is inactive on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_u: string, init: RequestInit) =>
          new Promise((_, reject) =>
            init.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      ),
    )
    expect((await fetchOutageConfig('u', 10)).active).toBe(false)
  })
})
