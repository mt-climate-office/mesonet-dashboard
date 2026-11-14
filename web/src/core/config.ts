// The Mesonet host for the dashboard and the API. At the cutover this becomes
// 'https://mesonet.climate.umt.edu'. Change it here, and in the CSP and README.
export const MESONET_ORIGIN = 'https://mesonet2.climate.umt.edu'

/** The dashboard's public address: canonical and og: tags (vite.config.ts fills index.html), installs (core/install). */
export const DASHBOARD_URL = `${MESONET_ORIGIN}/dash/`

// In dev we go through Vite's proxy at /_api/ so requests are same-origin.
// In production we hit the Mesonet v2 API directly (CORS is open).
// `import.meta.env?.`: vite.config.ts imports this file in Node, where there is no import.meta.env.
const PROD_API = `${MESONET_ORIGIN}/api/v2/`
const DEV_API = '/_api/'

export const API_URL =
  import.meta.env?.VITE_API_URL ?? (import.meta.env?.DEV ? DEV_API : PROD_API)

export const API_DOCS_URL = `${MESONET_ORIGIN}/api/v2/docs`

/** The API's OpenAPI document (the source of core/api/paramAllowlist.ts and openapi.d.ts). */
export const OPENAPI_URL = `${MESONET_ORIGIN}/api/openapi.json`

/** The public API base for links shown to users (API_URL is the dev proxy in dev). */
export const API_PUBLIC_URL = PROD_API

/**
 * The retired Dash app, on the on-prem host: the "previous dashboard" links in the legacy `?state=` and
 * `#satellite` notices (core/notices). Deliberately NOT derived from MESONET_ORIGIN: /dash on mesonet2 is
 * this dashboard. Whether these links stay is Kyle's call.
 */
export const LEGACY_DASHBOARD_URL = 'https://mesonet.climate.umt.edu/dash'

export const FEEDBACK_URL =
  'https://airtable.com/appUacO5Pq7wZYoJ3/pagqtNp2dSSjhkUkN'

/** GoatCounter endpoint for privacy-friendly page counts (core/analytics.ts). */
export const GOATCOUNTER_URL = 'https://mt-climate-office.goatcounter.com/count'
