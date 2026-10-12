import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpError, REQUEST_TIMEOUT_MS, TimeoutError, fetchText, timedFetch } from './http'
import { shouldRetry } from './retry'

/** A fetch that never answers until its signal aborts (a stalled request). */
const stalled = vi.fn((_url: string, init?: RequestInit) =>
  new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('timedFetch', () => {
  it('aborts a stalled request after the timeout with a retryable TimeoutError', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', stalled)
    const p = fetchText('stations/')
    const done = expect(p).rejects.toBeInstanceOf(TimeoutError)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await done
    expect(stalled.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(shouldRetry(new TimeoutError('u', 1), 1)).toBe(true)
  })

  it('covers reading the body too, and clears its timer once answered', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('ok')))
    const slowBody = timedFetch('u', {}, () => new Promise<string>(() => {}), 1000)
    const done = expect(slowBody).rejects.toBeInstanceOf(TimeoutError)
    await vi.advanceTimersByTimeAsync(1000)
    await done
    await expect(timedFetch('u', {}, (r) => r.text())).resolves.toBe('ok')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('passes other failures through: an HTTP error stays an HttpError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })))
    await expect(fetchText('stations/')).rejects.toBeInstanceOf(HttpError)
  })
})
