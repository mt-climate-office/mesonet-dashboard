import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Reuses vite.config.ts (plugins + the `@` alias). Unit tests are pure and
// run in Node; import describe/it/expect from 'vitest' explicitly so
// `tsc -b` typechecks test files without global type injection.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }),
)
