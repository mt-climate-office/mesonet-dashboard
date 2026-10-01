import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Path the app is served under. GitHub Pages project site by default;
// override with VITE_BASE (e.g. `/dash/`) when hosting elsewhere.
const base = process.env.VITE_BASE ?? '/mesonet-dashboard/'

// public/ files are copied verbatim, so substitute the base into the
// GitHub Pages 404 deep-link shim after the bundle is written.
function shim404Base(): Plugin {
  let outDir = 'dist'
  return {
    name: 'shim-404-base',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    writeBundle() {
      const file = join(outDir, '404.html')
      const html = readFileSync(file, 'utf8')
      writeFileSync(file, html.replaceAll('__BASE__', base.replace(/\/+$/, '')))
    },
  }
}

export default defineConfig({
  plugins: [react(), shim404Base()],
  base,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('plotly')) return 'plotly'
          if (id.includes('maplibre') || id.includes('react-map-gl')) return 'maplibre'
          if (id.includes('@mantine')) return 'mantine'
          return undefined
        },
      },
    },
  },
  optimizeDeps: {
    include: ['plotly.js-dist-min'],
  },
  server: {
    port: 5173,
    // Dev-only proxy so the browser sees a same-origin request and CORS is
    // never in the picture during local development. Production (GH Pages)
    // calls API_URL directly.
    proxy: {
      '/_api': {
        target: 'https://rtedqtj5uk.execute-api.us-west-2.amazonaws.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/_api/, ''),
      },
    },
  },
})
