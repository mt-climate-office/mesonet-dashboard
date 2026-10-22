/**
 * `x-data="navMeta"` on the header (partials/shell.html): the ⋯ menu's
 * actions (Share this view, Install app where it can be installed, the 3-state
 * Theme cycle, the US/metric Units switch, Help; Send feedback is a plain link). Also keeps `document.title` naming the selected station
 * (core/pageTitle.ts). The header is `.mco-navbar.is-sticky`, so the kit publishes its height as
 * `--chrome-h` (MCO.metrics).
 */
import Alpine from 'alpinejs'
import { FEEDBACK_URL } from '../../core/config'
import { toggleUnitsPatch } from '../../core/ag/view/gddCutoffs'
import { pageTitle } from '../../core/pageTitle'
import { saveUnits, unitsName } from '../../core/units'
import { browserStorage } from '../../stores/station'
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

    /** "US" or "Metric": the item's state text. */
    get unitsName(): string {
      return unitsName(Alpine.store('url').state.units)
    },
    get otherUnitsName(): string {
      return unitsName(Alpine.store('url').state.units === 'si' ? 'us' : 'si')
    },

    /** US ↔ metric: one URL patch (custom GDD cutoffs convert with it), saved for links without `?units=`. */
    toggleUnits() {
      const url = Alpine.store('url')
      const next = url.state.units === 'si' ? 'us' : 'si'
      url.set(toggleUnitsPatch(url.state, next))
      saveUnits(browserStorage(), next)
      announce(`${unitsName(next)} units`)
    },

    help: () => openHelp(),
  })
}
