import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
// maplibre CSS is loaded by StationMap (lazy chunk).
import './index.css'
import { App } from './App'
import { theme } from './lib/theme'
import { queryClient } from './lib/queryClient'

/**
 * Translate legacy `/mesonet-dashboard/<station>` deep-links into the
 * canonical `/mesonet-dashboard/?s=<station>` form so nuqs and the rest of
 * the app see a consistent URL shape. Runs synchronously before React mounts
 * so the first render already has the station selected.
 *
 * In production (GitHub Pages) the matching `docs/404.html` redirects unknown
 * paths to the index with the same `?s=` translation. In dev (Vite SPA
 * fallback) we never see a 404 so the translation happens here.
 */
function bootstrapPathBasedStation() {
  const path = window.location.pathname
  const baseRaw = import.meta.env.BASE_URL ?? '/'
  const base = baseRaw.replace(/\/+$/, '')
  if (!path.startsWith(`${base}/`) || path.length <= base.length + 1) return
  const segment = path.slice(base.length + 1).replace(/\/+$/, '')
  // Only treat single-segment lowercase identifiers as station IDs — anything
  // else (nested paths, etc.) we let the router/404 handle.
  if (!segment || segment.includes('/') || !/^[a-z0-9_-]+$/i.test(segment)) {
    return
  }
  const search = new URLSearchParams(window.location.search)
  if (!search.has('s')) search.set('s', segment)
  const qs = search.toString()
  const next = `${base}/${qs ? `?${qs}` : ''}${window.location.hash}`
  window.history.replaceState(null, '', next)
}

bootstrapPathBasedStation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <App />
        </NuqsAdapter>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
)
