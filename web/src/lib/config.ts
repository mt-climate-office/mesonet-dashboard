// In dev we go through Vite's proxy at /_api/ so requests are same-origin.
// In production we hit the Mesonet v2 API directly (CORS is open).
const PROD_API = 'https://mesonet2.climate.umt.edu/api/v2/'
const DEV_API = '/_api/'

export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? DEV_API : PROD_API)

export const API_DOCS_URL = 'https://mesonet2.climate.umt.edu/api/v2/docs'

export const LEGACY_DASHBOARD_URL = 'https://mesonet.climate.umt.edu/dash'

export const FEEDBACK_URL =
  'https://airtable.com/appUFCcxV0aoFaohE/shr5Y3hkNRP1YwZWv'
