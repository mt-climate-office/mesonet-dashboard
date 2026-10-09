/**
 * Entry point: fix up legacy URLs, register every store and component
 * (explicit list, in dependency order), then start Alpine. Runs after the
 * kit's classic scripts, so `window.MCO` and `maplibregl` already exist.
 */
import Alpine from 'alpinejs'
import { parseQcLevel, setQcOverride } from './core/api/qcLevel'
import { legacyRedirect } from './core/router'
import { readStation } from './core/stations/recent'
import { migrateLegacySearch, stationPathRedirect } from './core/url-schema'
import { createDataStore } from './stores/data'
import { browserStorage, createStationStore } from './stores/station'
import { createThemeStore } from './stores/theme'
import { createUrlStore } from './stores/url'
import { createViewStore } from './stores/view'
import { chart } from './ui/charts/chart'
import { chartTable } from './ui/charts/chartTable'
import { chartsView } from './ui/charts/chartsView'
import { compare } from './ui/charts/compare'
import { compareControls } from './ui/charts/compareControls'
import { customDates } from './ui/charts/customDates'
import { variableHistory } from './ui/charts/variableHistory'
import { variableRose } from './ui/charts/variableRose'
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
import { landingMap, locatorMap, pickerMap, stationMap } from './ui/map/presets'
import { photoCard } from './ui/now/photoCard'
import { windRoseCard } from './ui/now/windRoseCard'
import { nowView } from './ui/now/nowView'
import { dashboardView } from './ui/dashboard/dashboardView'
import { aboutView } from './ui/about/aboutView'
import { aboutDetails } from './ui/about/details'
import { aboutHistory } from './ui/about/history'
import { aboutReadings } from './ui/about/readings'
import { stationLanding } from './ui/picker/stationLanding'
import { stationPicker } from './ui/picker/stationPicker'
import { startAnalytics } from './ui/shell/analytics'
import { installTip, startInstall } from './ui/shell/install'
import { globalNotices } from './ui/shell/globalNotices'
import { toggletip } from './ui/shell/toggletip'
import { helpDialog } from './ui/shell/helpDialog'
import { menu } from './ui/shell/menu'
import { revealWhenReady } from './ui/shell/navigate'
import { navMeta } from './ui/shell/navMeta'
import { outageNotice } from './ui/shell/outageNotice'
import { popover } from './ui/shell/popover'
import { sections } from './ui/shell/sections'
import { sheet } from './ui/shell/sheet'
import { stationHeader } from './ui/shell/stationHeader'
import { initKeyboardInset } from './ui/layout/keyboard'
import './styles/app.css'
import './ui/layout/type.css'
import './ui/layout/shell.css'
import './ui/layout/card.css'
import './ui/layout/skeleton.css'
import './ui/layout/sectionNav.css'
import './ui/layout/drawer.css'
import './ui/layout/sheet.css'
import './ui/layout/menu.css'
import './ui/layout/popover.css'
import './ui/layout/transition.css'
import './ui/layout/toggletip.css'
import './ui/layout/carousel.css'
import './ui/controls/controls.css'
import './ui/map/map.css'
import './ui/charts/chart.css'
import './styles/downloader.css'
import './styles/picker.css'
import './styles/landing.css'
import './styles/now.css'
import './styles/now-cards.css'
import './styles/charts.css'
import './styles/about.css'
import './styles/dashboard.css'

// Ag tools, shown inside Charts while `v` is an Ag tool id
import { agAnnualView } from './ui/ag/agAnnualView'
import { agGddView } from './ui/ag/agGddView'
import { agMetView } from './ui/ag/agMetView'
import { agOptions } from './ui/ag/agOptions'
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

// Pre-namespacing keys (`from`/`to`/`time`/`vars`) → the old hash tab's keys, then old
// hashes → the three sections (core/router: #latest → Compare, #ag → Charts, #download → the sheet).
const migrated = migrateLegacySearch(location.search, location.hash)
if (migrated !== null) replaceUrl(migrated, location.hash)
const routed = legacyRedirect(location.search, location.hash)
if (routed) replaceUrl(routed.search, routed.hash)
// A bare #ag lands on the Charts list, scrolled to its Ag tools group once that renders.
if (routed?.anchor) revealWhenReady(routed.anchor)

// Hidden debugging key: `?level=0|1|2` sets the QC level of every default-QC request (core/api qcLevel).
setQcOverride(parseQcLevel(new URLSearchParams(location.search).get('level')))

// No `?s=`: reopen the remembered station (the catalog confirms it; a stale id shows the landing).
if (!new URLSearchParams(location.search).has('s')) {
  const last = readStation(browserStorage())
  if (last) {
    const params = new URLSearchParams(location.search)
    params.set('s', last)
    replaceUrl(`?${params.toString().replace(/%2C/gi, ',')}`, location.hash)
  }
}

/* 2. Stores. Order matters: each store's init() runs on registration and may
      read the stores above it (theme → url; station → url, data; view → url). ------- */

Alpine.store('url', createUrlStore())
Alpine.store('data', createDataStore())
Alpine.store('theme', createThemeStore())
Alpine.store('station', createStationStore())
Alpine.store('view', createViewStore())

/* 3. Components (one line each; x-data="<name>" in the partials). -------- */

// Shell (ui/shell/*): header actions, station button, section navs, ⋯ menus, popovers, modal
// sheets, notices, Help and outage dialogs, toggletips; the station picker and the no-station landing (ui/picker).
Alpine.data('navMeta', navMeta)
Alpine.data('stationHeader', stationHeader)
Alpine.data('sections', sections)
Alpine.data('menu', menu)
Alpine.data('popover', popover)
Alpine.data('sheet', sheet)
Alpine.data('stationPicker', stationPicker)
Alpine.data('stationLanding', stationLanding)
Alpine.data('helpDialog', helpDialog)
Alpine.data('outageNotice', outageNotice)
Alpine.data('globalNotices', globalNotices)
Alpine.data('installTip', installTip)
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
Alpine.data('pickerMap', pickerMap)
Alpine.data('landingMap', landingMap)
Alpine.data('locatorMap', locatorMap)

// Charts (W1): the one ECharts host; ECharts itself loads lazily on the first
// render. x-data="chart({ builder, table, label, model: () => …, onZoom, range })".
Alpine.data('chart', chart)

// Charts (ui/charts): section view switch, variable list, variable page + history, a chart as a
// table, the Custom dates sheet's form, Compare.
Alpine.data('chartsView', chartsView)
Alpine.data('variableList', variableList)
Alpine.data('variablePage', variablePage)
Alpine.data('variableHistory', variableHistory)
Alpine.data('variableRose', variableRose)
Alpine.data('chartTable', chartTable)
Alpine.data('customDates', customDates)
Alpine.data('compare', compare)
Alpine.data('compareControls', compareControls)

// Now (ui/now): the overview section.
Alpine.data('nowView', nowView)
// The big-screen dashboard (ui/dashboard): every variable's chart and the range chips; its other cards reuse Now's and About's components.
Alpine.data('dashboardView', dashboardView)
// Now's panes (ui/now): the latest photo + its dialog, the wind rose (no camera).
Alpine.data('photoCard', photoCard)
Alpine.data('windRoseCard', windRoseCard)

// About (ui/about): the section wrapper and its cards (details, current readings, sensor changes).
Alpine.data('aboutView', aboutView)
Alpine.data('aboutDetails', aboutDetails)
Alpine.data('aboutReadings', aboutReadings)
Alpine.data('aboutHistory', aboutHistory)

// Data Downloader (W2): the Download sheet's one component (ui/downloader/downloader.ts);
// x-data="downloader" in partials/downloader/index.html, inside partials/sheets/download.html.
Alpine.data('downloader', downloader)

// Ag tools (W2, ui/ag/*): the open tool in Charts, its option chips, one view per variable group.
Alpine.data('agTab', agTab)
Alpine.data('agOptions', agOptions)
Alpine.data('agMetView', agMetView)
Alpine.data('agGddView', agGddView)
Alpine.data('agSoilView', agSoilView)
Alpine.data('agAnnualView', agAnnualView)

Alpine.start()

// Bottom sheets and docked popovers stay above an on-screen keyboard (iOS Safari covers them otherwise).
initKeyboardInset()

// Page counts (GoatCounter; skipped off production and under DNT/GPC).
startAnalytics()
// Install the app: the manifest on the install address, the browser's prompt, the phone tip (after analytics, which it counts with).
startInstall()
document.documentElement.classList.add('layout-ready')
