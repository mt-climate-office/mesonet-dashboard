import { describe, expect, it } from 'vitest'
import { RESUME_GAP_MS, TICK_MS, createTicker } from './freshness'

function setup() {
  let t = 0
  let ticks = 0
  const timers = new Map<number, () => void>()
  let id = 0
  const ticker = createTicker({
    onTick: () => ticks++,
    now: () => t,
    setInterval: (fn) => (timers.set(++id, fn), id),
    clearInterval: (i) => timers.delete(i),
  })
  return {
    ticker,
    ticks: () => ticks,
    timers,
    /** Advance the clock by `ms`, firing the interval once per TICK_MS passed. */
    advance(ms: number) {
      for (let left = ms; left > 0; left -= TICK_MS) {
        t += Math.min(left, TICK_MS)
        if (left >= TICK_MS) for (const fn of timers.values()) fn()
      }
    },
  }
}

describe('createTicker', () => {
  it('ticks every TICK_MS while visible, and not while hidden', () => {
    const s = setup()
    s.ticker.visible()
    expect(s.ticks()).toBe(0)
    s.advance(2 * TICK_MS)
    expect(s.ticks()).toBe(2)
    s.ticker.hidden()
    expect(s.timers.size).toBe(0)
    s.advance(3 * TICK_MS)
    expect(s.ticks()).toBe(2)
  })

  it('ticks on becoming visible only when the last tick is at least RESUME_GAP_MS old', () => {
    const s = setup()
    s.ticker.visible()
    s.ticker.hidden()
    s.advance(RESUME_GAP_MS - 1)
    s.ticker.visible()
    expect(s.ticks()).toBe(0)
    s.ticker.hidden()
    s.advance(1)
    s.ticker.visible()
    expect(s.ticks()).toBe(1)
    expect(s.timers.size).toBe(1)
  })

  it('a repeated visible() keeps one interval', () => {
    const s = setup()
    s.ticker.visible()
    s.ticker.visible()
    expect(s.timers.size).toBe(1)
  })

  it('a bfcache restore ticks at once and keeps one interval', () => {
    const s = setup()
    s.ticker.visible()
    s.ticker.restored()
    expect(s.ticks()).toBe(1)
    expect(s.timers.size).toBe(1)
  })
})
