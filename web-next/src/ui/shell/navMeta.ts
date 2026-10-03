/**
 * `x-data="navMeta"` on the header (partials/shell.html): the ⋯ menu's
 * actions (Share this view, the 3-state Theme cycle, Help; Send feedback is
 * a plain link). Also keeps `document.title` naming the selected station
 * (core/pageTitle.ts) and publishes the header height as `--chrome-h`.
 */
import Alpine from 'alpinejs'
import { FEEDBACK_URL } from '../../core/config'
import { pageTitle } from '../../core/pageTitle'
import { publishHeight } from '../layout/sectionNav'
import { component } from '../component'
import { openHelp } from './helpDialog'
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
      // --chrome-h: the sticky header's height, for the drawer and sheet offsets.
      publishHeight(this.$el as HTMLElement, '--chrome-h')
    },

    /** Copy the view's URL (ui/shell/share.ts). */
    share: () => shareView(),

    /** dark → light → high contrast; the menu stays open and the item's state text follows. */
    cycleTheme() {
      const theme = Alpine.store('theme')
      theme.cycle()
      announce(`${theme.name} theme`)
    },

    help: () => openHelp(),
  })
}
