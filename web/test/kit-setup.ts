/**
 * vitest setupFiles: put the pinned kit's `MCO` (core, photos, places and summary, evaluated from the SRI-checked bytes)
 * on the test global, as the page's classic scripts do before the app module runs.
 */
import { loadKit } from './kit'

Object.assign(globalThis, { MCO: loadKit() })
