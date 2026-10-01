import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_OUTAGE_CONFIG,
  coerceOutageConfig,
  fetchOutageConfig,
  outageMantineColor,
  outageStorageKey,
} from './outageConfig'

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

describe('outageMantineColor', () => {
  it('maps bootstrap names', () => {
    expect(outageMantineColor('warning')).toBe('yellow')
    expect(outageMantineColor('danger')).toBe('red')
    expect(outageMantineColor('info')).toBe('cyan')
    expect(outageMantineColor('success')).toBe('green')
  })
  it('passes Mantine names through and defaults to yellow', () => {
    expect(outageMantineColor('teal')).toBe('teal')
    expect(outageMantineColor('nonsense')).toBe('yellow')
  })
})

describe('outageStorageKey', () => {
  it('matches the legacy key', () => {
    expect(outageStorageKey('2026-08-13-partial-outage')).toBe(
      'outageModalShown:2026-08-13-partial-outage',
    )
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
