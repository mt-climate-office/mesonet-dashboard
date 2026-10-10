# core/palette

The one place for data colors (HOUSE-STYLE §6). Pure TypeScript, no DOM.

| File | Holds |
|---|---|
| `ramps.ts` | Approved ramps as hex stops (Crameri batlow/romaO, ColorBrewer RdBu/BrBG/YlGnBu/YlOrRd/Blues/PuRd, Tol bright/muted/high-contrast) and `sample()` / `colorAt()` (OKLab interpolation). No Spectral. |
| `roles.ts` | Every chart/map color role → color per theme (`'dark' \| 'light' \| 'high-contrast'`), plus `resolve()` for kit tokens. |
| `contrast.ts` | WCAG luminance and `contrastRatio()`. |
| `tokens.snapshot.ts` | Kit 0.11.2 surface/text tokens the tests measure against. |

Which legacy color each role replaces: `web-next/DIVERGENCES.md` "House style › Data colors" (update it with any role change).

## Adding or changing a role

1. Add a constant (or function) in `roles.ts` keyed by `Theme`, built from a ramp in `ramps.ts` or a kit token.
2. Put the WCAG ratio against that theme's `--bg-surface` in a comment next to each hex.
3. If it is a line, marker or bar, add it to `lineMarkerColors()` in `palette.test.ts`; the test fails below 3:1.
4. Pair color with a second channel (label, shape, dash or hatch).

## Tokens

Colors that should follow the kit (selection ring, dim reference lines, the current-year line) are
`{ token: '--text-dim', alpha?: 0.18 }`, not hex. The chart host turns them into CSS colors with
`resolve(c, (name) => getComputedStyle(document.documentElement).getPropertyValue(name))`
and re-resolves on theme change. Plain strings pass through `resolve()` unchanged.
