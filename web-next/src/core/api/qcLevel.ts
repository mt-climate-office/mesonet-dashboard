/**
 * The QC level the app asks for (the API's `level`: 0 raw, 1 provisional, 2 quality-controlled).
 * Hidden `?level=` debugging override, set once by main.ts before any fetch; fixed for the
 * page's life, so cache keys need not carry it. The Downloader keeps its own `qc` choice.
 */
import type { QcLevel } from '../ag/contract'

const LEVELS: readonly QcLevel[] = [0, 1, 2]

let override: QcLevel | null = null

/** `?level=` read as a QC level, or null when absent or not 0/1/2. */
export function parseQcLevel(raw: string | null): QcLevel | null {
  const n = raw === null || raw.trim() === '' ? NaN : Number(raw)
  return (LEVELS as readonly number[]).includes(n) ? (n as QcLevel) : null
}

/** Set the override (null clears it). Call before the first fetch. */
export function setQcOverride(level: QcLevel | null): void {
  override = level
}

/** The override, or null when the app uses the default. */
export const qcOverride = (): QcLevel | null => override

/** The level every default-QC request sends: the override, else 2. */
export const qcLevel = (): QcLevel => override ?? 2
