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
import { navMeta } from './ui/shell/navMeta'
import { tabBar } from './ui/shell/tabBar'
import './styles/app.css'

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

Alpine.data('tabBar', tabBar)
Alpine.data('navMeta', navMeta)

Alpine.start()
