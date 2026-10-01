/**
 * Shared pieces for the Ag Tools figure builders. Every builder in this
 * folder is pure: contract series (SI) in → Plotly `data`/`layout` out. SI →
 * US conversion (°F, in, bar, mph) happens here, at the display edge, via
 * `compute/units.ts`; nothing upstream converts.
 */
import type { Data, Layout } from 'plotly.js'
import type { LocalDate, LocalDateTime, Nullable } from '../contract'

export interface Figure {
  data: Data[]
  layout: Partial<Layout>
}

export type Period = 'daily' | 'hourly'

export const baseLayout: Partial<Layout> = {
  autosize: true,
  margin: { l: 70, r: 70, t: 30, b: 50 },
  hovermode: 'x',
  plot_bgcolor: 'rgba(0,0,0,0)',
  paper_bgcolor: 'rgba(0,0,0,0)',
  font: { size: 12 },
}

/** Plotly hover date format for a period. */
export const hoverDate = (period: Period) =>
  period === 'hourly' ? '%{x|%b %d, %Y %H:%M}' : '%{x|%b %d, %Y}'

/**
 * Plotly x values. Local (America/Denver) wall-clock strings, which Plotly
 * plots as-is: `YYYY-MM-DD` for daily rows, `YYYY-MM-DD HH:mm` for hourly.
 */
export const xValues = (time: (LocalDate | LocalDateTime)[]): string[] =>
  time.map((t) => (t.length > 10 ? t.replace('T', ' ') : t))

export const finiteMax = (values: Nullable[]): number => {
  let m = 0
  for (const v of values) if (v != null && Number.isFinite(v) && v > m) m = v
  return m
}

/** Nominal soil-sensor depths, cm → the dashboard's inch labels (LAB_SWAP). */
const CM_TO_IN: Record<number, number> = { 5: 2, 10: 4, 20: 8, 50: 20, 70: 28, 91: 36, 100: 40 }

export const depthLabel = (cm: number): string => `${CM_TO_IN[cm] ?? Math.round(cm / 2.54)} in`

/**
 * Columnar counterpart of `lib/gaps.ts` `insertGaps` (same rule: a step
 * longer than `thresholdRatio` × the median cadence gets a null row) for
 * line traces built from contract series. The data layer already gap-fills
 * its time axes with null rows, so this is normally a no-op; it guards line
 * traces against any axis that skips rows (e.g. an API-sourced series).
 * Gap rows reuse the preceding x, which is enough for Plotly to break the line.
 */
export function insertGapsColumnar<T extends Nullable[]>(
  epochMs: number[],
  x: string[],
  ys: T[],
  thresholdRatio = 1.5,
): { x: string[]; ys: Nullable[][] } {
  if (epochMs.length < 3) return { x, ys }
  const deltas: number[] = []
  for (let i = 1; i < epochMs.length; i++) {
    const d = epochMs[i] - epochMs[i - 1]
    if (d > 0) deltas.push(d)
  }
  if (deltas.length === 0) return { x, ys }
  const cadence = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)]
  const threshold = cadence * thresholdRatio
  const outX: string[] = [x[0]]
  const outYs: Nullable[][] = ys.map((y) => [y[0]])
  for (let i = 1; i < epochMs.length; i++) {
    if (epochMs[i] - epochMs[i - 1] > threshold) {
      outX.push(x[i - 1])
      outYs.forEach((y) => y.push(null))
    }
    outX.push(x[i])
    outYs.forEach((y, k) => y.push(ys[k][i]))
  }
  return { x: outX, ys: outYs }
}

/**
 * Content-derived key for `<Plot revision>`: changes whenever the figure's
 * structure (trace types/names/axes, layout axes) or its extent (point
 * counts, first/last x) changes, so Plot purges and re-plots instead of
 * diffing between unrelated figures. (The old key, `traces << 4 ^
 * variable.length`, collided across variables and windows.)
 */
export function figureKey(fig: Figure): number {
  const sig = JSON.stringify({
    t: fig.data.map((d) => {
      const r = d as Record<string, unknown>
      const x = r.x as unknown[] | undefined
      return [r.type, r.name, r.yaxis, r.mode, x?.length ?? 0, x?.[0], x?.[x.length - 1]]
    }),
    l: Object.keys(fig.layout).sort(),
    y: (fig.layout.yaxis as Record<string, unknown> | undefined)?.type,
  })
  let h = 0x811c9dc5
  for (let i = 0; i < sig.length; i++) {
    h ^= sig.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
