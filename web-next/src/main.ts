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
import { chartsView } from './ui/charts/chartsView'
import { compare } from './ui/charts/compare'
import { compareControls } from './ui/charts/compareControls'
import { variableHistory } from './ui/charts/variableHistory'
import { variableList } from './ui/charts/variableList'
import { variablePage } from './ui/charts/variablePage'
import { chips } from './ui/controls/chips'
import { combobox } from './ui/controls/combobox'
import { dateInput } from './ui/controls/dateInput'
import { dateRange } from './ui/controls/dateRange'
import { multiselect } from './ui/controls/multiselect'
import { rangeSlider } from './ui/controls/rangeSlider'
import { segmented } from './ui/controls/segmented'
import { timeSelect } from './ui/controls/timeSelect'
import { downloader } from './ui/downloader/downloader'
import { downloaderMap, locatorMap, pickerMap, stationMap } from './ui/map/presets'
import { forecastCard } from './ui/now/forecastCard'
import { photoCard } from './ui/now/photoCard'
import { windRoseCard } from './ui/now/windRoseCard'
import { nowView } from './ui/now/nowView'
import { aboutView } from './ui/about/aboutView'
import { aboutDetails } from './ui/about/details'
import { aboutHistory } from './ui/about/history'
import { aboutReadings } from './ui/about/readings'
import { stationPicker } from './ui/picker/stationPicker'
import { startAnalytics } from './ui/shell/analytics'
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
import './styles/now-cards.css'
import './styles/charts.css'
import './styles/about.css'

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
Alpine.data('locatorMap', locatorMap)

// Charts (W1): the one ECharts host; ECharts itself loads lazily on the first
// render. x-data="chart({ builder, table, label, model: () => …, onZoom, range })".
Alpine.data('chart', chart)

// Charts (ui/charts): section view switch, variable list, variable page + history, Compare.
Alpine.data('chartsView', chartsView)
Alpine.data('variableList', variableList)
Alpine.data('variablePage', variablePage)
Alpine.data('variableHistory', variableHistory)
Alpine.data('compare', compare)
Alpine.data('compareControls', compareControls)

// Now (ui/now): the overview section.
Alpine.data('nowView', nowView)
// Now's panes (ui/now): the latest photo + its dialog, the wind rose (no camera), the NWS forecast.
Alpine.data('photoCard', photoCard)
Alpine.data('windRoseCard', windRoseCard)
Alpine.data('forecastCard', forecastCard)

// About (ui/about): the section wrapper and its cards (details, current readings, sensor changes).
Alpine.data('aboutView', aboutView)
Alpine.data('aboutDetails', aboutDetails)
Alpine.data('aboutReadings', aboutReadings)
Alpine.data('aboutHistory', aboutHistory)

// Data Downloader (W2): the Download section's one component (ui/downloader/downloader.ts);
// x-data="downloader" in partials/downloader/index.html.
Alpine.data('downloader', downloader)

// Ag Tools (W2, ui/ag/*): tab wrapper, controls card, one view per variable group.
Alpine.data('agTab', agTab)
Alpine.data('agControls', agControls)
Alpine.data('agMetView', agMetView)
Alpine.data('agGddView', agGddView)
Alpine.data('agSoilView', agSoilView)
Alpine.data('agAnnualView', agAnnualView)

Alpine.start()

// Page counts (GoatCounter; skipped off production and under DNT/GPC).
startAnalytics()
document.documentElement.classList.add('layout-ready')
