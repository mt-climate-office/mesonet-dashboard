/**
 * Typing helper for Alpine components: wrap a component's object literal so
 * `this` inside it sees Alpine's magics ($watch, $refs, $el, $store, …).
 * Runtime identity; it adds no behaviour.
 */
import type Alpine from 'alpinejs'

/** `return component({ … })` from an `Alpine.data` factory. */
export const component = <T>(obj: Alpine.AlpineComponent<T>): Alpine.AlpineComponent<T> => obj
