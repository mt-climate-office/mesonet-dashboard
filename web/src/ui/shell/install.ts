/**
 * "Install the app" (core/install.ts decides what to offer). On the install
 * address it links the manifest, relative to the page, so it resolves under
 * /dash/next/ behind the Caddy proxy; elsewhere there is no manifest and no
 * offer. It keeps the browser's `beforeinstallprompt` for the ⋯ menu's
 * Install app and the phone tip (`x-data="installTip"`, partials/shell.html).
 */
import Alpine from 'alpinejs'
import { installOffer, isInstallHome, isIos, showTip, TIP_KEY, tipText, type InstallOffer } from '../../core/install'
import { component } from '../component'
import { countEvent } from './analytics'
import { announce } from './live'

interface PromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const home = isInstallHome(location)
const standalone = (): boolean =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

let deferred: PromptEvent | null = null
const state = Alpine.reactive({ canPrompt: false, installed: false, tipOpen: false })

/** The current offer (reactive). */
export function offer(): InstallOffer {
  if (state.installed) return 'none'
  return installOffer({ home, standalone: standalone(), canPrompt: state.canPrompt, ios: isIos(navigator.userAgent, navigator.maxTouchPoints) })
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(TIP_KEY) === 'dismissed'
  } catch {
    return false
  }
}

/** Link the manifest (install address only) and listen for the browser's prompt. Call once, early. */
export function startInstall(): void {
  if (standalone()) countEvent('launch/installed', 'Opened from the home screen')
  if (!home) return
  const link = Object.assign(document.createElement('link'), { rel: 'manifest', href: 'manifest.webmanifest' })
  document.head.append(link)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as PromptEvent
    state.canPrompt = true
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    state.canPrompt = false
    state.installed = true
    countEvent('install', 'App installed')
  })
  state.tipOpen = !readDismissed()
}

/**
 * Install app: the browser's prompt where there is one (it can be used once), else show the
 * iOS steps in the tip, opened again even if it was dismissed.
 */
export async function install(): Promise<void> {
  if (deferred) {
    const e = deferred
    deferred = null
    state.canPrompt = false
    await e.prompt()
    const { outcome } = await e.userChoice
    if (outcome === 'accepted') countEvent('install/prompt', 'Install accepted')
    return
  }
  if (offer() === 'ios') {
    state.tipOpen = true
    window.scrollTo({ top: 0 })
    announce(tipText('ios'))
  }
}

/** `x-data="installTip"`: the one-time phone tip above the section. */
export function installTip() {
  return component({
    get shown(): boolean {
      const phone = matchMedia('(max-width: 640px), (hover: none) and (pointer: coarse)').matches
      return state.tipOpen && showTip(offer(), { phone, hasStation: !!Alpine.store('station').id, dismissed: false })
    },
    get text(): string {
      return tipText(offer())
    },
    get canPrompt(): boolean {
      return offer() === 'prompt'
    },
    install: () => install(),
    dismiss(): void {
      state.tipOpen = false
      try {
        localStorage.setItem(TIP_KEY, 'dismissed')
      } catch {
        // Ignore: it shows again next visit.
      }
    },
  })
}
