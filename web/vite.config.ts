/**
 * Vite config for the dashboard. Served under VITE_BASE (default: the Pages
 * path /mesonet-dashboard/; the Mesonet host proxies it at /dash/, src/core/config.ts DASHBOARD_URL, and
 * proxies /mesonet-dashboard/ too, so the absolute base works there). index.html pulls in partials/ via the
 * @include plugin, then htmlConstants fills __DASHBOARD_URL__ / __MESONET_ORIGIN__ from config.ts; the dev
 * server proxies the API to dodge CORS.
 */
import { defineConfig } from 'vite'
import { DASHBOARD_URL, MESONET_ORIGIN } from './src/core/config.ts'
import { htmlConstants, htmlInclude } from './vite/include.ts'

const base = process.env.VITE_BASE ?? '/mesonet-dashboard/'

export default defineConfig({
  base,
  plugins: [htmlInclude(), htmlConstants({ DASHBOARD_URL, MESONET_ORIGIN })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    port: 5174,
    // Same-origin in dev (connect-src 'self'); production calls the API directly.
    proxy: {
      '/_api': {
        target: MESONET_ORIGIN,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/_api/, '/api/v2'),
      },
    },
  },
  preview: { port: 4174 },
})
