/**
 * The About section's sensor-change history: `/config/{station}/` instruments
 * (the same response Compare's sensor overlays use) → the days a sensor was
 * installed or removed, newest first. Outages stay on the Compare charts.
 */
import type { RawInstrument } from '../sensorEvents'
import { ELEMENT_LABELS, parseWallClock } from '../sensorEvents'
import { formatDay } from './details'

export interface SensorChange {
  kind: 'installed' | 'removed'
  /** "Vaisala HMP155E (RH/T)". */
  sensor: string
  /** Readable measurements, e.g. "Air Temperature, Relative Humidity"; "" when none are public. */
  measures: string
}

export interface SensorChangeDay {
  /** "YYYY-MM-DD", for keys and sorting. */
  date: string
  /** "Aug 2, 2024". */
  label: string
  /** Installs first, then removals; each by sensor name. */
  changes: SensorChange[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Element codes → unique labels without units ("Soil VWC @ 2 in"); codes with no public label are dropped. */
export function measuresText(elements: unknown): string {
  const codes = Array.isArray(elements) ? elements.map(String) : elements == null ? [] : [String(elements)]
  const labels = codes.map((c) => ELEMENT_LABELS[c]?.replace(/\s*\[[^\]]*\]$/, '')).filter((l): l is string => !!l)
  return [...new Set(labels)].join(', ')
}

/** "Manufacturer Model (Type)", leaving out blank parts. */
export function sensorName(ins: RawInstrument): string {
  const name = [str(ins.manufacturer), str(ins.model)].filter(Boolean).join(' ') || 'Unknown sensor'
  const type = str(ins.type)
  return type ? `${name} (${type})` : name
}

/**
 * Installs (`date_start`) and removals (`date_end`) grouped by day, newest day
 * first. Parallel `date_start`/`date_end` arrays are one deployment each;
 * "None" and blank dates are skipped; duplicate instruments collapse.
 */
export function sensorHistory(instruments: readonly RawInstrument[] | null | undefined): SensorChangeDay[] {
  const days = new Map<string, Map<string, SensorChange>>()
  const add = (date: unknown, change: SensorChange) => {
    if (typeof date !== 'string' || parseWallClock(date) === null) return
    const day = date.slice(0, 10)
    const changes = days.get(day) ?? new Map<string, SensorChange>()
    changes.set(`${change.kind}|${change.sensor}|${change.measures}`, change)
    days.set(day, changes)
  }
  for (const ins of instruments ?? []) {
    const sensor = sensorName(ins)
    const measures = measuresText(ins.elements)
    const starts: unknown[] = Array.isArray(ins.date_start) ? ins.date_start : [ins.date_start]
    const ends: unknown[] = Array.isArray(ins.date_end) ? ins.date_end : [ins.date_end]
    for (const d of starts) add(d, { kind: 'installed', sensor, measures })
    for (const d of ends) add(d, { kind: 'removed', sensor, measures })
  }
  const order = (a: SensorChange, b: SensorChange) => a.kind.localeCompare(b.kind) || a.sensor.localeCompare(b.sensor)
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, changes]) => ({ date, label: formatDay(date) ?? date, changes: [...changes.values()].sort(order) }))
}
