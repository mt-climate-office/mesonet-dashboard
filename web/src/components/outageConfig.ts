/**
 * Site-wide outage notice, driven by `outage.json` on the repo's main branch
 * (port of app/mdb/utils/outage.py). Turning the notice on or off is a
 * content edit to that file, not a deploy.
 */

export const OUTAGE_CONFIG_URL: string =
  import.meta.env.VITE_OUTAGE_URL ??
  'https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/outage.json'

export const OUTAGE_FETCH_TIMEOUT_MS = 5000

export interface OutageConfig {
  active: boolean
  id: string
  title: string
  color: string
  message: string
  button_text: string
}

export const DEFAULT_OUTAGE_CONFIG: Readonly<OutageConfig> = {
  active: false,
  id: '',
  title: 'Montana Mesonet Notice',
  color: 'warning',
  message: '',
  button_text: 'Got it',
}

/**
 * Port of `_coerce`: merge over the defaults, stringify fields, and treat a
 * blank message as inactive so clearing the text takes the notice down.
 */
export function coerceOutageConfig(raw: unknown): OutageConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_OUTAGE_CONFIG }
  }
  const r = raw as Record<string, unknown>
  const merged: Record<string, unknown> = { ...DEFAULT_OUTAGE_CONFIG }
  for (const key of Object.keys(DEFAULT_OUTAGE_CONFIG)) {
    if (key in r && r[key] !== null && r[key] !== undefined) merged[key] = r[key]
  }
  const message = String(merged.message)
  return {
    active: Boolean(merged.active) && message.trim() !== '',
    id: String(merged.id),
    title: String(merged.title),
    color: String(merged.color),
    message,
    button_text: String(merged.button_text),
  }
}

/** Bootstrap alert colors (what outage.json uses) → Mantine palette names. */
const BOOTSTRAP_TO_MANTINE: Record<string, string> = {
  warning: 'yellow',
  danger: 'red',
  info: 'cyan',
  success: 'green',
  primary: 'blue',
  secondary: 'gray',
  light: 'gray',
  dark: 'dark',
}

const MANTINE_COLORS = new Set([
  'dark', 'gray', 'red', 'pink', 'grape', 'violet', 'indigo', 'blue',
  'cyan', 'teal', 'green', 'lime', 'yellow', 'orange',
])

export function outageMantineColor(color: string): string {
  const c = color.trim().toLowerCase()
  return BOOTSTRAP_TO_MANTINE[c] ?? (MANTINE_COLORS.has(c) ? c : 'yellow')
}

/** sessionStorage key: show each notice once per browser tab. */
export const outageStorageKey = (id: string) => `outageModalShown:${id}`

/** Fetch + coerce; any failure (network, timeout, bad JSON) → inactive. */
export async function fetchOutageConfig(
  url: string = OUTAGE_CONFIG_URL,
  timeoutMs: number = OUTAGE_FETCH_TIMEOUT_MS,
): Promise<OutageConfig> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' })
    if (!r.ok) return { ...DEFAULT_OUTAGE_CONFIG }
    return coerceOutageConfig(await r.json())
  } catch {
    return { ...DEFAULT_OUTAGE_CONFIG }
  } finally {
    clearTimeout(timer)
  }
}
