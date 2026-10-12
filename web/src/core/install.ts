/**
 * "Install the app" (a home-screen web app; ui/shell/install.ts). Installs
 * point at one address, `INSTALL_HOME`, since an installed app is tied to the
 * URL it was installed from: the manifest is linked there only. Android and
 * desktop Chromium offer a real prompt (`beforeinstallprompt`); iOS has none,
 * so iPhone and iPad get the Share → Add to Home Screen steps instead. Pure.
 */

/** Where installs point (user decision 2026-10-08): the Caddy-proxied build on the Mesonet host. */
export const INSTALL_HOME = { hostname: 'mesonet.climate.umt.edu', pathname: '/dash/next/' } as const

/** localStorage key: the phone tip was dismissed (app-prefixed, HOUSE-STYLE §4). */
export const TIP_KEY = 'mco-dashboard-install-tip'

/** True on the install address (any query or hash). */
export function isInstallHome(loc: { hostname: string; pathname: string }): boolean {
  return loc.hostname === INSTALL_HOME.hostname && loc.pathname === INSTALL_HOME.pathname
}

/** iPhone, iPod or iPad (iPadOS reports a Mac with touch); every iOS browser can Add to Home Screen. */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

export interface InstallEnv {
  /** `isInstallHome(location)`. */
  home: boolean
  /** Already running as the installed app (display-mode standalone, or iOS `navigator.standalone`). */
  standalone: boolean
  /** The browser fired `beforeinstallprompt` and the prompt is still unused. */
  canPrompt: boolean
  /** `isIos(...)`. */
  ios: boolean
}

/** What to offer: the browser's prompt, the iOS steps, or nothing (installed, elsewhere, or not installable here). */
export type InstallOffer = 'prompt' | 'ios' | 'none'

export function installOffer(env: InstallEnv): InstallOffer {
  if (!env.home || env.standalone) return 'none'
  if (env.canPrompt) return 'prompt'
  return env.ios ? 'ios' : 'none'
}

/** The one-time phone tip: an offer, on a phone, once a station is open (not over the first-load landing), until dismissed. */
export function showTip(offer: InstallOffer, opts: { phone: boolean; hasStation: boolean; dismissed: boolean }): boolean {
  return offer !== 'none' && opts.phone && opts.hasStation && !opts.dismissed
}

/** The tip's text for an offer. */
export function tipText(offer: InstallOffer): string {
  return offer === 'ios'
    ? 'To install, tap Share, then “Add to Home Screen”.'
    : 'Install the dashboard on your phone for one-tap access.'
}
