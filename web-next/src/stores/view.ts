/**
 * `$store.view`: which page the section host renders (core/dashboard `pageFor`). `wide` is true
 * while the content column (beside the station drawer, so an open drawer counts) and the window
 * have room for the dashboard; it follows resizes and the drawer. Registered after `url`.
 */
import Alpine from 'alpinejs'
import { pageFor, showsDashboard, type Page } from '../core/dashboard'

export interface ViewStore {
  /** Room for the dashboard (core/dashboard `showsDashboard`). */
  wide: boolean
  /** What the section host shows: the dashboard, or the URL's section page. */
  readonly page: Page
  init(): void
}

export function createViewStore(): ViewStore {
  return {
    wide: false,

    get page() {
      const url = Alpine.store('url')
      return pageFor(url.section, url.state, this.wide)
    },

    init() {
      const content = document.querySelector<HTMLElement>('.dash-content')
      if (!content) return
      const measure = () => {
        // 0 while x-cloak hides the column at boot: the observer measures again once it shows.
        if (content.clientWidth) this.wide = showsDashboard(content.clientWidth, window.innerHeight)
      }
      new ResizeObserver(measure).observe(content)
      window.addEventListener('resize', measure)
      measure()
    },
  }
}
