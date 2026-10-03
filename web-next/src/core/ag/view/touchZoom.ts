/**
 * Ag charts on touch screens: drop the `inside` dataZoom so a swipe over a
 * chart scrolls the page (the date controls and, on wider screens, the
 * slider still zoom). Applied by ui/ag/shared.ts under `(hover: none)`. Pure.
 * TODO(P1 Charts): use the shared touch option in core/charts/axes.ts once it lands.
 */
import type { EChartsOption } from 'echarts'

/** `option` without its `inside` dataZoom entries; other entries are kept as they are. */
export function withoutInsideZoom(option: EChartsOption): EChartsOption {
  const zoom = option.dataZoom
  if (!Array.isArray(zoom)) return option
  return { ...option, dataZoom: zoom.filter((z) => z.type !== 'inside') }
}
