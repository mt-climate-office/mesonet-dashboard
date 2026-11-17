import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDailyNormals } from './normals'

const CSV = 'month,day,mean,std_dev,median,min,max,q25,q75,type,variable,station\n1,1,30,9,32,0,50,23,41,daily,tmmx,x'

/** Stubs fetch with one response (or a network failure) per call; returns the call count. */
function stubFetch(...answers: Array<number | 'network'>) {
  const fn = vi.fn(async () => {
    const a = answers.shift()
    if (a === 'network') throw new TypeError('Failed to fetch')
    return new Response(a === 200 ? CSV : 'x', { status: a })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('fetchDailyNormals', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('caches a 404 as no normals', async () => {
    const fetch = stubFetch(404)
    expect(await fetchDailyNormals('st404', 'tmmx')).toEqual([])
    expect(await fetchDailyNormals('st404', 'tmmx')).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws on a 5xx or a network error without caching it, so the next call refetches', async () => {
    const fetch = stubFetch(503, 'network', 200)
    await expect(fetchDailyNormals('st503', 'tmmx')).rejects.toThrow(/503/)
    await expect(fetchDailyNormals('st503', 'tmmx')).rejects.toThrow()
    expect(await fetchDailyNormals('st503', 'tmmx')).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
