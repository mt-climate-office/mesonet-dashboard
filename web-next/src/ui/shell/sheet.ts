/**
 * Modal sheets: `x-data="sheet({ id, urlKey? })"` on a `.dash-sheet.dash-sheet--modal`
 * (partials/sheets/*.html), the Alpine wrapper over ui/layout/sheet.ts. A
 * bottom sheet on phones, a centred panel from tablet up; modal at every
 * size (page inert, Esc closes, focus in and back). Open or close one from
 * any component with `openSheet(id, opener)` / `closeSheet(id)`. With
 * `urlKey` (the Download sheet's `dl`), the URL key is the open state: opening
 * sets it, closing clears it, and a URL that has it opens the sheet on load.
 * Content inside `<template x-if="isOpen">` mounts (and fetches) only while open.
 */
import Alpine from 'alpinejs'
import type { UrlState } from '../../core/url-schema'
import { initSheet, type Sheet } from '../layout/sheet'
import { component } from '../component'

const EVENT = 'dash:sheet'
type Detail = { id: string; open: boolean; opener: HTMLElement | null }

/** Open sheet `id`; `opener` (default: the focused element) gets focus back on close. */
export const openSheet = (id: string, opener: HTMLElement | null = null): void =>
  void window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { id, open: true, opener } }))

/** Close sheet `id` (focus returns to its opener). */
export const closeSheet = (id: string): void => void window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { id, open: false, opener: null } }))

/** URL keys a sheet may be bound to: boolean schema keys. */
type SheetKey = 'dl'

/** The page behind a modal sheet (made inert while it is open). Live regions and the toast stay outside it. */
const background = () => [...document.querySelectorAll('.mco-skip-link, .mco-navbar, .dash-shell, .dash-tabbar')]

export function sheet(cfg: { id: string; urlKey?: SheetKey }) {
  let ctl: Sheet | null = null
  let opener: HTMLElement | null = null
  const cleanups: (() => void)[] = []
  const url = () => Alpine.store('url')
  const setKey = (on: boolean) => {
    if (cfg.urlKey && url().state[cfg.urlKey] !== on) url().set({ [cfg.urlKey]: on } as Partial<UrlState>)
  }
  return component({
    isOpen: false,

    init() {
      const panel = this.$el as HTMLElement
      ctl = initSheet({
        panel,
        handle: panel.querySelector<HTMLElement>('.dash-sheet-handle')!,
        scrim: document.getElementById(`${panel.id}-scrim`),
        background,
        toggles: () => [],
        onChange: (open) => {
          this.isOpen = open
          if (!open) setKey(false)
        },
      })
      panel.hidden = true

      const onEvent = (e: Event) => {
        const d = (e as CustomEvent<Detail>).detail
        if (d.id !== cfg.id) return
        if (d.open) {
          opener = d.opener ?? (document.activeElement as HTMLElement | null)
          if (cfg.urlKey) setKey(true)
          else this.show()
        } else if (cfg.urlKey) setKey(false)
        else ctl?.close()
      }
      window.addEventListener(EVENT, onEvent)
      cleanups.push(() => window.removeEventListener(EVENT, onEvent))

      // A bound sheet follows its URL key (on load, after openSheet, after closeSheet).
      if (cfg.urlKey) {
        const key = cfg.urlKey
        const fx = Alpine.effect(() => {
          const want = url().state[key]
          if (want && !ctl?.isOpen) this.show()
          else if (!want && ctl?.isOpen) ctl.close()
        })
        cleanups.push(() => Alpine.release(fx))
      }
    },

    /** Open at full height; focus returns to the opener, or to <main> when the URL opened it. */
    show(): void {
      ctl?.open({ state: 'full', opener: opener ?? document.getElementById('main') })
      opener = null
    },
    close(): void {
      ctl?.close()
    },

    destroy() {
      cleanups.forEach((f) => f())
      ctl?.destroy()
      ctl = null
    },
  })
}
