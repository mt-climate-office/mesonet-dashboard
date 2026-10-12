/**
 * View Transitions wrapper (framework-free; kit candidate `MCO.transition`,
 * KIT-NOTES.md). `withTransition(update)` runs `update` inside
 * `document.startViewTransition` when the browser has it and reduced motion is
 * off; otherwise it just runs it. CSS (ui/layout/transition.css): a 180 ms
 * cross-fade + short slide on the `dash-section` region, direction from
 * `<html data-vt-dir="forward|back">`.
 */

export interface TransitionOptions {
  /** 'forward' slides the new view in from the right, 'back' from the left. */
  direction?: 'forward' | 'back'
}

const reduced = () => (typeof MCO !== 'undefined' ? MCO.reducedMotion() : matchMedia('(prefers-reduced-motion: reduce)').matches)

type StartVT = (cb: () => Promise<void> | void) => { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> }

/** True when a transition would actually animate here. */
export const canTransition = (): boolean => typeof document !== 'undefined' && 'startViewTransition' in document && !reduced()

/** Run `update` (which may be async, e.g. awaiting Alpine.nextTick) inside a view transition. */
export async function withTransition(update: () => void | Promise<void>, opts: TransitionOptions = {}): Promise<void> {
  if (!canTransition()) {
    await update()
    return
  }
  const root = document.documentElement
  root.dataset.vtDir = opts.direction ?? 'forward'
  const vt = (document.startViewTransition as unknown as StartVT).call(document, async () => {
    await update()
  })
  // A quick second navigation skips this one: `ready` then rejects, which is expected, not an error.
  vt.ready.catch(() => {})
  try {
    await vt.finished
  } catch {
    /* skipped (e.g. a second navigation started); the update already ran */
  } finally {
    delete root.dataset.vtDir
  }
}
