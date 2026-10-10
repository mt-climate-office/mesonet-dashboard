/**
 * `x-data="navMeta"` on the header (partials/shell.html): the ⋯ menu's
 * actions (Share this view, Install app where it can be installed, the 3-state
 * Theme cycle, Help; Send feedback is a plain link). Also keeps `document.title` naming the selected station
 * (core/pageTitle.ts). The header is `.mco-navbar.is-sticky`, so the kit publishes its height as
 * `--chrome-h` (MCO.metrics).
 */
import Alpine from 'alpinejs'
import { FEEDBACK_URL } from '../../core/config'
import { pageTitle } from '../../core/pageTitle'
import { component } from '../component'
import { openHelp } from './helpDialog'
import { install, offer } from './install'
import { announce } from './live'
import { shareView } from './share'

export function navMeta() {
  return component({
    feedbackUrl: FEEDBACK_URL,

    init() {
      // The header is permanent, so this effect lives as long as the page.
      Alpine.effect(() => {
        document.title = pageTitle(Alpine.store('station').current?.name)
      })
    },

    /** Copy the view's URL (ui/shell/share.ts). */
    share: () => shareView(),

    /** Install app (ui/shell/install.ts): shown only where there is something to offer. */
    get canInstall(): boolean {
      return offer() !== 'none'
    },
    install: () => install(),

    /** dark → light → high contrast; the menu stays open and the item's state text follows. */
    cycleTheme() {
      const theme = Alpine.store('theme')
      theme.cycle()
      announce(`${theme.name} theme`)
    },

    help: () => openHelp(),
  })
}
