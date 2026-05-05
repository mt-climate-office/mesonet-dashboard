import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  base: '/mesonet-dashboard/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../docs',
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
