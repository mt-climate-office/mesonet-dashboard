/**
 * Test-only parity helpers: align a compute output with a golden `/derived`
 * fixture by timestamp and summarise the difference. Every comparison is
 * recorded so a test file can print a parity table (`PARITY|…` lines).
 */
import type { Nullable } from '../contract'
import { num, parseApiDatetime, type Row } from './adapters'

export interface Parity {
  label: string
  /** Rows where both sides have a value. */
  n: number
  maxAbs: number
  /** Rows where exactly one side is null. */
  nullMismatch: number
  /** First offending (time, expected, actual) for debugging. */
  worst: { time: string; expected: Nullable; actual: Nullable } | null
}

export const PARITY_LOG: Parity[] = []

/**
 * Compare `actual[i]` (keyed by `times[i]`, local date or local datetime) with
 * fixture column `colName`. `toFixtureUnits` maps compute (SI) → fixture (US).
 */
export function compareToFixture(
  label: string,
  fixture: Row[],
  colName: string,
  times: string[],
  actual: Nullable[],
  toFixtureUnits: (x: number) => number = (x) => x,
  key: 'date' | 'local' = 'local',
): Parity {
  const byTime = new Map<string, Nullable>()
  times.forEach((t, i) => byTime.set(t, actual[i]))
  let n = 0
  let maxAbs = 0
  let nullMismatch = 0
  let worst: Parity['worst'] = null
  for (const r of fixture) {
    const t = parseApiDatetime(r.datetime)[key]
    const e = num(r[colName])
    const a0 = byTime.get(t)
    const a = a0 == null ? null : toFixtureUnits(a0)
    if (e == null && a == null) continue
    if (e == null || a == null) {
      nullMismatch++
      worst ??= { time: t, expected: e, actual: a }
      continue
    }
    n++
    const d = Math.abs(e - a)
    if (d > maxAbs) {
      maxAbs = d
      worst = { time: t, expected: e, actual: a }
    }
  }
  const p = { label, n, maxAbs, nullMismatch, worst }
  PARITY_LOG.push(p)
  return p
}

/** Diagnostics are printed only with `VITE_PARITY=1 npm test` (keeps CI output quiet). */
export const PARITY_VERBOSE = import.meta.env.VITE_PARITY === '1'

export function parityLog(line: string): void {
  if (PARITY_VERBOSE) console.log(line)
}

export function printParity(): void {
  for (const p of PARITY_LOG) {
    parityLog(
      `PARITY|${p.label}|n=${p.n}|max=${p.maxAbs.toFixed(5)}|nullMismatch=${p.nullMismatch}|worst=${JSON.stringify(p.worst)}`,
    )
  }
  PARITY_LOG.length = 0
}
