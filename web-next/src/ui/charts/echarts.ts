/**
 * The tree-shaken ECharts build: every chart type and component the
 * dashboard draws, registered once. Loaded lazily by chart.ts (its own
 * chunk), so the entry bundle stays small. Add a part here before using it.
 */
import * as echarts from 'echarts/core'
import { BarChart, CustomChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  AriaComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  PolarComponent,
  TooltipComponent,
  VisualMapContinuousComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  ScatterChart,
  CustomChart,
  GridComponent,
  PolarComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  TooltipComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  VisualMapContinuousComponent,
  VisualMapPiecewiseComponent,
  GraphicComponent,
  AriaComponent,
  CanvasRenderer,
])

export { echarts }
