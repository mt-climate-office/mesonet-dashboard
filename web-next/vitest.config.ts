/**
 * Vitest: every test is pure and runs in Node. Test files import
 * describe/it/expect from 'vitest' explicitly (no injected globals).
 */
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'vite/**/*.test.ts'],
    },
  }),
)
