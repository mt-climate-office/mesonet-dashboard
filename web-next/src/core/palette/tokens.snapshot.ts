// Snapshot of the kit tokens that palette tests measure against.
// Copied from mco-web-style v0.11.2 tokens/tokens.json (themes.{dark,light,highContrast}).
// Refresh by hand when the kit is bumped; palette.test.ts fails if a role color loses contrast.

import type { Theme } from './roles'

/** Chart background (`--bg-surface`) and the token values roles reference, per theme. */
export const TOKENS_SNAPSHOT: Record<Theme, Record<string, string>> = {
  dark: {
    '--bg-surface': '#1e2530',
    '--text-primary': '#e8ecf0',
    '--text-dim': '#8494ab',
    '--selection-ring': '#5aaee8',
  },
  light: {
    '--bg-surface': '#ffffff',
    '--text-primary': '#1a1a2e',
    '--text-dim': '#5f6675',
    '--selection-ring': '#1563a0',
  },
  'high-contrast': {
    '--bg-surface': '#000000',
    '--text-primary': '#ffffff',
    '--text-dim': '#bcbcbc',
    '--selection-ring': '#93d0ff',
  },
}
