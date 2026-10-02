import { describe, expect, it, vi } from 'vitest'
import { HttpError } from './api/http'
import { shouldRetry } from './api/retry'
import { createCache } from './cache'

const tick = () => new Promise((r) => setTimeout(r, 0))

function setup() {
  let t = 0
  const cache = createCache({ now: () => t, sleep: () => Promise.resolve() })
  return { cache, advance: (ms: number) => (t += ms) }
}

describe('shouldRetry', () => {
  it('retries network and 5xx twice, never 4xx', () => {
    expect(shouldRetry(new TypeError('Failed to fetch'), 1)).toBe(true)
    expect(shouldRetry(new HttpError(503, 'u', ''), 2)).toBe(true)
    expect(shouldRetry(new HttpError(503, 'u', ''), 3)).toBe(false)
    expect(shouldRetry(new HttpError(404, 'u', ''), 1)).toBe(false)
    expect(shouldRetry(new HttpError(422, 'u', ''), 1)).toBe(false)
  })
})

describe('createCache', () => {
  it('dedupes in-flight requests and returns one live object per key', async () => {
    const { cache } = setup()
    const f = vi.fn(async () => 42)
    const a = cache.cached('k', f)
    const b = cache.cached('k', f)
    expect(a).toBe(b)
    expect(a.status).toBe('loading')
    await tick()
    expect(f).toHaveBeenCalledTimes(1)
    expect(a).toMatchObject({ status: 'success', data: 42, error: null })
  })

  it('refetches after ttl in the background, keeping data meanwhile', async () => {
    const { cache, advance } = setup()
    let n = 0
    const f = vi.fn(async () => ++n)
    const r = cache.cached('k', f, { ttl: 1000 })
    await tick()
    advance(500)
    cache.cached('k', f, { ttl: 1000 })
    expect(f).toHaveBeenCalledTimes(1)
    advance(600)
    cache.cached('k', f, { ttl: 1000 })
    expect(r).toMatchObject({ status: 'success', data: 1 })
    await tick()
    expect(f).toHaveBeenCalledTimes(2)
    expect(r.data).toBe(2)
  })

  it('retries 5xx then succeeds; a 4xx fails at once and stays failed until refresh', async () => {
    const { cache } = setup()
    let calls = 0
    const flaky = cache.cached('5xx', async () => {
      if (++calls < 3) throw new HttpError(502, 'u', '')
      return 'ok'
    })
    await tick()
    await tick()
    expect(calls).toBe(3)
    expect(flaky.data).toBe('ok')

    const bad = vi.fn(async () => {
      throw new HttpError(422, 'u', '')
    })
    const r = cache.cached('4xx', bad)
    await tick()
    expect(bad).toHaveBeenCalledTimes(1)
    expect(r.status).toBe('error')
    expect((r.error as HttpError).status).toBe(422)
    cache.cached('4xx', bad)
    await tick()
    expect(bad).toHaveBeenCalledTimes(1)
    r.refresh()
    expect(r.status).toBe('loading')
    await tick()
    expect(bad).toHaveBeenCalledTimes(2)
  })

  it('retry: false fails on the first network error', async () => {
    const { cache } = setup()
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const r = cache.cached('k', f, { retry: false })
    await tick()
    expect(f).toHaveBeenCalledTimes(1)
    expect(r.status).toBe('error')
  })

  it('ignores a response that arrives after a newer fetch started', async () => {
    const { cache } = setup()
    const resolvers: ((v: string) => void)[] = []
    const f = () => new Promise<string>((res) => resolvers.push(res))
    const r = cache.cached('k', f)
    r.refresh()
    resolvers[1]('new')
    await tick()
    resolvers[0]('old')
    await tick()
    expect(r.data).toBe('new')
  })

  it('invalidate drops entries by prefix', async () => {
    const { cache } = setup()
    const f = vi.fn(async () => 1)
    cache.cached('obs:a', f)
    cache.cached('meta', f)
    cache.invalidate('obs:')
    cache.cached('obs:a', f)
    cache.cached('meta', f)
    expect(f).toHaveBeenCalledTimes(3)
  })
})
