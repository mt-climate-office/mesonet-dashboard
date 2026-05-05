import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Config, Data, Layout } from 'plotly.js'
import Plotly from 'plotly.js-dist-min'

/**
 * react-plotly.js (the upstream wrapper) is built for React 16, leans on
 * `prop-types`/`findDOMNode`, and ships as CJS that Vite + React 19 can't
 * reliably interop with. We use Plotly's imperative API ourselves with a
 * tiny React-friendly wrapper. Keeps us on plotly.js-dist-min (smaller
 * bundle) without the React-major-version mismatch.
 */
/**
 * Subset of Plotly's relayout event payload we care about. Plotly emits keys
 * like `xaxis.range[0]` / `xaxis.range[1]` for partial range updates, and
 * `xaxis.autorange: true` when the user double-clicks to reset.
 */
export interface PlotRelayoutEvent {
  'xaxis.range[0]'?: string | number
  'xaxis.range[1]'?: string | number
  'xaxis.range'?: [string | number, string | number]
  'xaxis.autorange'?: boolean
  [key: string]: unknown
}

export interface PlotProps {
  data: Data[]
  layout?: Partial<Layout>
  config?: Partial<Config>
  style?: CSSProperties
  className?: string
  /** When changed, forces a fresh purge + newPlot rather than React updates. */
  revision?: number
  onInitialized?: (gd: HTMLDivElement) => void
  onUpdate?: (gd: HTMLDivElement) => void
  /** Fires when the user pans, zooms, or otherwise changes the layout. */
  onRelayout?: (event: PlotRelayoutEvent) => void
}

const RESPONSIVE_DEFAULT: Partial<Config> = {
  responsive: true,
  displaylogo: false,
}

export function Plot({
  data,
  layout,
  config,
  style,
  className,
  revision,
  onInitialized,
  onUpdate,
  onRelayout,
}: PlotProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  // Track the revision used for the last full purge+newPlot so external
  // callers can force a fresh layout (e.g. when subplot count changes).
  const lastRevision = useRef<number | undefined>(undefined)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const cfg = { ...RESPONSIVE_DEFAULT, ...config }

    // Use Plotly.react for fast diffing; on revision change we wipe & re-plot
    // because reacting between figures with very different layouts (e.g. a
    // different subplot count) leaves stray axes lingering.
    const shouldPurge = revision !== lastRevision.current
    if (shouldPurge) {
      try {
        Plotly.purge(el)
      } catch {
        // ignore
      }
      lastRevision.current = revision
    }
    Plotly.react(el, data, layout ?? {}, cfg).then(() => {
      // Plotly attaches event handlers via .on (jQuery-style). We rebind on
      // every render so the latest onRelayout closure (which captures fresh
      // state) is wired up.
      const plotEl = el as unknown as {
        on?: (event: string, cb: (e: unknown) => void) => void
        removeAllListeners?: (event: string) => void
      }
      plotEl.removeAllListeners?.('plotly_relayout')
      if (onRelayout) {
        plotEl.on?.('plotly_relayout', (event) => {
          onRelayout(event as PlotRelayoutEvent)
        })
      }

      if (shouldPurge) {
        onInitialized?.(el)
      } else {
        onUpdate?.(el)
      }
    })
  }, [data, layout, config, revision, onInitialized, onUpdate, onRelayout])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return () => {
      try {
        Plotly.purge(el)
      } catch {
        // ignore
      }
    }
  }, [])

  return <div ref={ref} className={className} style={style} />
}
