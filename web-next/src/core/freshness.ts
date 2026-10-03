/**
 * The freshness tick's schedule: when to advance the tick that live cache
 * reads depend on (stores/data.ts wires it to the page's visibility events).
 * Pure apart from the injected timers, so it is unit-tested in Node.
 */

/** Tick period while the page is visible. */
export const TICK_MS = 5 * 60_000
/** A return to the page ticks at once only if the last tick is at least this old. */
export const RESUME_GAP_MS = 60_000

export interface TickerDeps {
  onTick: () => void
  now?: () => number
  setInterval?: (fn: () => void, ms: number) => number
  clearInterval?: (id: number) => void
}

/**
 * A ticker: `visible()` ticks if the last tick is ≥ RESUME_GAP_MS old and
 * (re)starts the TICK_MS interval; `hidden()` stops it; `restored()` (a
 * bfcache restore) ticks at once. Created idle; the caller reports the
 * current visibility. Creation counts as a tick (the first reads fetch).
 */
export function createTicker(deps: TickerDeps) {
  const now = deps.now ?? Date.now
  const every = deps.setInterval ?? ((fn, ms) => setInterval(fn, ms) as unknown as number)
  const stop = deps.clearInterval ?? ((id) => clearInterval(id))
  let last = now()
  let timer: number | null = null

  const tick = () => {
    last = now()
    deps.onTick()
  }
  const start = () => {
    if (timer === null) timer = every(tick, TICK_MS)
  }
  const hidden = () => {
    if (timer !== null) stop(timer)
    timer = null
  }

  return {
    visible(): void {
      if (now() - last >= RESUME_GAP_MS) tick()
      start()
    },
    hidden,
    restored(): void {
      tick()
      hidden()
      start()
    },
  }
}
