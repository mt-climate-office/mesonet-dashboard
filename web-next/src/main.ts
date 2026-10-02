/**
 * Entry point: fix up legacy URLs, register every store and component
 * (explicit list, in dependency order), then start Alpine. Runs after the
 * kit's classic scripts, so `window.MCO` and `maplibregl` already exist.
 */
import Alpine from 'alpinejs'
import { migrateLegacySearch, stationPathRedirect } from './core/url-schema'
import { createDataStore } from './stores/data'
import { createStationStore } from './stores/station'
import { createThemeStore } from './stores/theme'
import { createUrlStore } from './stores/url'
import { chart } from './ui/charts/chart'
import { chips } from './ui/controls/chips'
import { combobox } from './ui/controls/combobox'
import { dateInput } from './ui/controls/dateInput'
import { dateRange } from './ui/controls/dateRange'
import { multiselect } from './ui/controls/multiselect'
import { rangeSlider } from './ui/controls/rangeSlider'
import { segmented } from './ui/controls/segmented'
import { timeSelect } from './ui/controls/timeSelect'
import { downloaderMap, stationMap } from './ui/map/presets'
import { globalNotices } from './ui/shell/globalNotices'
import { helpDialog } from './ui/shell/helpDialog'
import { navMeta } from './ui/shell/navMeta'
import { outageNotice } from './ui/shell/outageNotice'
import { tabBar } from './ui/shell/tabBar'
import './styles/app.css'
import './ui/controls/controls.css'
import './ui/map/map.css'
import './ui/charts/chart.css'
// Latest Data (W2 layout/sidebar/timeseries).
import { latestSidebar } from './ui/latest/sidebar'
import { latestTimeseries } from './ui/latest/timeseries'
import './styles/latest.css'

/* 1. URL fix-ups, before any store reads `location`. ---------------------- */

// `/<base>/<station>` deep links → `?s=<station>`. On Pages, 404.html does
// this before the app loads; the dev server serves index.html for any path.
const base = import.meta.env.BASE_URL.replace(/\/+$/, '')
const toCanonical = stationPathRedirect(location.pathname, location.search, location.hash, base)
if (toCanonical) history.replaceState(null, '', toCanonical)

// Pre-namespacing keys (`from`/`to`/`time`/`vars`) → the hash tab's keys.
const migrated = migrateLegacySearch(location.search, location.hash)
if (migrated !== null) history.replaceState(history.state, '', `${location.pathname}${migrated}${location.hash}`)

/* 2. Stores. Order matters: each store's init() runs on registration and may
      read the stores above it (theme → url; station → url, data). ------- */

Alpine.store('url', createUrlStore())
Alpine.store('data', createDataStore())
Alpine.store('theme', createThemeStore())
Alpine.store('station', createStationStore())

/* 3. Components (one line each; x-data="<name>" in the partials). -------- */

// Global UI (W1): navbar, notices, Help and outage dialogs (ui/shell/*).
Alpine.data('tabBar', tabBar)
Alpine.data('navMeta', navMeta)
Alpine.data('helpDialog', helpDialog)
Alpine.data('outageNotice', outageNotice)
Alpine.data('globalNotices', globalNotices)

// Form controls (ui/controls/README.md): x-data="combobox({ … })" etc.
Alpine.data('combobox', combobox)
Alpine.data('multiselect', multiselect)
Alpine.data('dateRange', dateRange)
Alpine.data('dateInput', dateInput)
Alpine.data('timeSelect', timeSelect)
Alpine.data('segmented', segmented)
Alpine.data('chips', chips)
Alpine.data('rangeSlider', rangeSlider)

// Station maps (ui/map/presets.ts): x-data="stationMap({ stations, selected, onSelect })".
Alpine.data('stationMap', stationMap)
Alpine.data('downloaderMap', downloaderMap)

// Charts (W1): the one ECharts host; ECharts itself loads lazily on the first
// render. x-data="chart({ builder, table, label, model: () => …, onZoom, range })".
Alpine.data('chart', chart)

// Latest Data (W2 layout/sidebar/timeseries): partials/latest/index.html.
Alpine.data('latestSidebar', latestSidebar)
Alpine.data('latestTimeseries', latestTimeseries)

Alpine.start()
