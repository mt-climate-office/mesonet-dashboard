import type { ObservationRow } from './api'

/**
 * Detect missing-observation gaps in a time series and insert synthetic rows
 * with all values null so that Plotly's `connectgaps: false` actually breaks
 * the line at those points.
 *
 * Why this is needed: the new RDS API drops rows entirely when an
 * observation is missing (verified empirically — `rm_na=True` and
 * `rm_na=False` return identical row counts on the raw `/observations`
 * endpoint). With no `null` y-values in the response, Plotly cheerfully
 * connects across what should be a gap.
 *
 * The cadence is auto-detected as the median of pairwise interval lengths,
 * so 5-minute (LoggerNet) and 15-minute (Zentra/AgriMet) stations both work
 * without explicit configuration. Anything more than ~`thresholdRatio` × the
 * median cadence gets a null row inserted right after the preceding sample.
 */
export function insertGaps(
  rows: ObservationRow[],
  thresholdRatio = 1.5,
): ObservationRow[] {
  if (rows.length < 3) return rows

  // Pre-parse timestamps once so we don't pay the cost twice.
  const times = rows.map((r) => Date.parse(String(r.datetime)))

  // Detect cadence via median pairwise delta.
  const deltas: number[] = []
  for (let i = 1; i < times.length; i++) {
    const d = times[i] - times[i - 1]
    if (Number.isFinite(d) && d > 0) deltas.push(d)
  }
  if (deltas.length === 0) return rows
  const sorted = [...deltas].sort((a, b) => a - b)
  const cadence = sorted[Math.floor(sorted.length / 2)]
  if (!Number.isFinite(cadence) || cadence <= 0) return rows
  const threshold = cadence * thresholdRatio

  // Build a template object with every observation column set to null. We
  // reuse it (shallow-spread) for each gap so the resulting rows have the
  // same shape as real ones — important because the chart layer keys traces
  // off the column set.
  const sample = rows[0] as Record<string, unknown>
  const nullTemplate: Record<string, unknown> = {}
  for (const k of Object.keys(sample)) {
    nullTemplate[k] = k === 'station' ? sample.station : null
  }

  const out: ObservationRow[] = [rows[0]]
  for (let i = 1; i < rows.length; i++) {
    const dt = times[i] - times[i - 1]
    if (Number.isFinite(dt) && dt > threshold) {
      // Place the synthetic null sample one cadence past the prior point.
      // Plotly only needs a null y to break the line — the x just has to
      // sit between the two real points.
      const gapTimeMs = times[i - 1] + cadence
      out.push({
        ...nullTemplate,
        datetime: new Date(gapTimeMs).toISOString(),
      } as ObservationRow)
    }
    out.push(rows[i])
  }
  return out
}
