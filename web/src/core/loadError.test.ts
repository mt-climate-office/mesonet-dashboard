import { describe, expect, it } from 'vitest'
import { HttpError, TimeoutError } from './api/http'
import { loadErrorKind, loadErrorText } from './loadError'

describe('loadErrorKind', () => {
  it('classifies timeouts, 429, 5xx, other 4xx and network failures', () => {
    expect(loadErrorKind(new TimeoutError('u', 30_000))).toBe('timeout')
    expect(loadErrorKind(new HttpError(429, 'u', ''))).toBe('busy')
    expect(loadErrorKind(new HttpError(503, 'u', ''))).toBe('server')
    expect(loadErrorKind(new HttpError(404, 'u', ''))).toBe('refused')
    expect(loadErrorKind(new TypeError('Failed to fetch'))).toBe('network')
    expect(loadErrorKind(undefined)).toBe('network')
  })
})

describe('loadErrorText', () => {
  it('says what failed and why, never the raw URL or body', () => {
    const t = loadErrorText('This chart', new HttpError(503, 'https://x/observations?secret', '<html>'))
    expect(t).toBe('This chart could not be loaded: the server had a problem.')
    expect(loadErrorText('The preview', new TimeoutError('u', 30_000))).toContain('took too long')
  })
})
