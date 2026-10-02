/**
 * Vite config for web-next. Served under VITE_BASE (default: the Pages
 * preview path /mesonet-dashboard/next/). index.html pulls in partials/ via
 * the @include plugin; the dev server proxies the API to dodge CORS.
 */
import { defineConfig } from 'vite'
import { htmlInclude } from './vite/include.ts'

const base = process.env.VITE_BASE ?? '/mesonet-dashboard/next/'

export default defineConfig({
  base,
  plugins: [htmlInclude()],
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
        target: 'https://mesonet2.climate.umt.edu',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/_api/, '/api/v2'),
      },
    },
  },
  preview: { port: 4174 },
})
