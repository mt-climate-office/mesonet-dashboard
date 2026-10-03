/**
 * Entry point: fix up legacy URLs, register every store and component
 * (explicit list, in dependency order), then start Alpine. Runs after the
 * kit's classic scripts, so `window.MCO` and `maplibregl` already exist.
 */
import Alpine from 'alpinejs'
import { legacyRedirect } from './core/router'
import { readStation } from './core/stations/recent'
import { migrateLegacySearch, stationPathRedirect } from './core/url-schema'
import { createDataStore } from './stores/data'
import { browserStorage, createStationStore } from './stores/station'
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
import { downloader } from './ui/downloader/downloader'
import { downloaderMap, pickerMap, stationMap } from './ui/map/presets'
import { bottomCard } from './ui/latest/cards/bottomCard'
import { currentCard } from './ui/latest/cards/currentCard'
import { forecastCard } from './ui/latest/cards/forecastCard'
import { metadataCard } from './ui/latest/cards/metadataCard'
import { photoCard } from './ui/latest/cards/photoCard'
import { topCard } from './ui/latest/cards/topCard'
import { windRoseCard } from './ui/latest/cards/windRoseCard'
import { nowView } from './ui/now/nowView'
import { stationPicker } from './ui/picker/stationPicker'
import { globalNotices } from './ui/shell/globalNotices'
import { toggletip } from './ui/shell/toggletip'
import { helpDialog } from './ui/shell/helpDialog'
import { navMeta } from './ui/shell/navMeta'
import { outageNotice } from './ui/shell/outageNotice'
import { sections } from './ui/shell/sections'
import { stationHeader } from './ui/shell/stationHeader'
import './styles/app.css'
import './ui/layout/type.css'
import './ui/layout/shell.css'
import './ui/layout/card.css'
import './ui/layout/skeleton.css'
import './ui/layout/sectionNav.css'
import './ui/layout/drawer.css'
import './ui/layout/sheet.css'
import './ui/layout/transition.css'
import './ui/layout/toggletip.css'
import './ui/controls/controls.css'
import './ui/map/map.css'
import './ui/charts/chart.css'
import './styles/downloader.css'
import './styles/picker.css'
import './styles/now.css'
import './styles/about.css'

// Latest Data (W2 layout/sidebar/timeseries), shown as Charts → Compare until P1.
import { latestLayout } from './ui/latest/layout'
import { latestSidebar } from './ui/latest/sidebar'
import { latestTimeseries } from './ui/latest/timeseries'
import './styles/latest.css'
import './styles/cards.css'
// Ag Tools (W2)
import { agAnnualView } from './ui/ag/agAnnualView'
import { agControls } from './ui/ag/agControls'
import { agGddView } from './ui/ag/agGddView'
import { agMetView } from './ui/ag/agMetView'
import { agSoilView } from './ui/ag/agSoilView'
import { agTab } from './ui/ag/agTab'
import './styles/ag.css'

/* 1. URL fix-ups, before any store reads `location`. ---------------------- */

const replaceUrl = (search: string, hash: string) => history.replaceState(history.state, '', `${location.pathname}${search}${hash}`)

// `/<base>/<station>` deep links → `?s=<station>`. On Pages, 404.html does
// this before the app loads; the dev server serves index.html for any path.
const base = import.meta.env.BASE_URL.replace(/\/+$/, '')
const toCanonical = stationPathRedirect(location.pathname, location.search, location.hash, base)
if (toCanonical) history.replaceState(null, '', toCanonical)

// Pre-namespacing keys (`from`/`to`/`time`/`vars`) → the old hash tab's keys,
// then the old tab hashes → sections (#latest → #charts&cmp=1, #downloader → #download).
const migrated = migrateLegacySearch(location.search, location.hash)
if (migrated !== null) replaceUrl(migrated, location.hash)
const routed = legacyRedirect(location.search, location.hash)
if (routed) replaceUrl(routed.search, routed.hash)

// No `?s=`: reopen the remembered station (the catalog confirms it; a stale id opens the picker).
if (!new URLSearchParams(location.search).has('s')) {
  const last = readStation(browserStorage())
  if (last) {
    const params = new URLSearchParams(location.search)
    params.set('s', last)
    replaceUrl(`?${params.toString().replace(/%2C/gi, ',')}`, location.hash)
  }
}

/* 2. Stores. Order matters: each store's init() runs on registration and may
      read the stores above it (theme → url; station → url, data). ------- */

Alpine.store('url', createUrlStore())
Alpine.store('data', createDataStore())
Alpine.store('theme', createThemeStore())
Alpine.store('station', createStationStore())

/* 3. Components (one line each; x-data="<name>" in the partials). -------- */

// Shell (ui/shell/*): navbar meta, station switcher + header, section navs,
// notices, Help and outage dialogs, toggletips; the station picker (ui/picker).
Alpine.data('navMeta', navMeta)
Alpine.data('stationHeader', stationHeader)
Alpine.data('sections', sections)
Alpine.data('stationPicker', stationPicker)
Alpine.data('helpDialog', helpDialog)
Alpine.data('outageNotice', outageNotice)
Alpine.data('globalNotices', globalNotices)
Alpine.data('toggletip', toggletip)

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
Alpine.data('pickerMap', pickerMap)

// Charts (W1): the one ECharts host; ECharts itself loads lazily on the first
// render. x-data="chart({ builder, table, label, model: () => …, onZoom, range })".
Alpine.data('chart', chart)

// Now (ui/now): the overview section.
Alpine.data('nowView', nowView)

// Data Downloader (W2): the Download section's one component (ui/downloader/downloader.ts);
// x-data="downloader" in partials/downloader/index.html.
Alpine.data('downloader', downloader)

// Latest Data (W2 layout/sidebar/timeseries): partials/latest/index.html (Charts → Compare).
Alpine.data('latestLayout', latestLayout)
Alpine.data('latestSidebar', latestSidebar)
Alpine.data('latestTimeseries', latestTimeseries)
// Latest cards (W2; partials/latest/cards/*): top and bottom card switchers and their panes,
// also reused by Now (photo, wind rose, forecast) and About (metadata, current readings).
Alpine.data('topCard', topCard)
Alpine.data('windRoseCard', windRoseCard)
Alpine.data('forecastCard', forecastCard)
Alpine.data('photoCard', photoCard)
Alpine.data('bottomCard', bottomCard)
Alpine.data('metadataCard', metadataCard)
Alpine.data('currentCard', currentCard)
// Ag Tools (W2, ui/ag/*): tab wrapper, controls card, one view per variable group.
Alpine.data('agTab', agTab)
Alpine.data('agControls', agControls)
Alpine.data('agMetView', agMetView)
Alpine.data('agGddView', agGddView)
Alpine.data('agSoilView', agSoilView)
Alpine.data('agAnnualView', agAnnualView)

Alpine.start()
document.documentElement.classList.add('layout-ready')
