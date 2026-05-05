// In dev we go through Vite's proxy at /_api/ to dodge CORS while it's being
// rolled out upstream. In production we hit API Gateway directly.
const PROD_API = 'https://rtedqtj5uk.execute-api.us-west-2.amazonaws.com/'
const DEV_API = '/_api/'

export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? DEV_API : PROD_API)

export const LEGACY_DASHBOARD_URL = 'https://mesonet.climate.umt.edu/dash'

export const FEEDBACK_URL =
  'https://airtable.com/appUFCcxV0aoFaohE/shr5Y3hkNRP1YwZWv'
