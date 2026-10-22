/**
 * Vitest: every test is pure and runs in Node. Test files import
 * describe/it/expect from 'vitest' explicitly (no injected globals).
 * The one global is the kit's `MCO`: the pinned core + photos files from
 * index.html, fetched once, SRI-checked and evaluated in node:vm (test/kit.ts).
 */
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'vite/**/*.test.ts', 'test/**/*.test.ts'],
      globalSetup: ['test/kit-global.ts'],
      setupFiles: ['test/kit-setup.ts'],
    },
  }),
)
