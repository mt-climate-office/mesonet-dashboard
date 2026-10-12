/**
 * `x-data="globalNotices"` on the banner stack at the top of `<main>`: legacy
 * `?state=` links and `#satellite` (inline banner + toast), and the
 * live-region line when `$store.station` rewrites an NWSLI / mis-cased `?s=`.
 */
import Alpine from 'alpinejs'
import { legacyStateHash, withoutLegacyState } from '../../core/legacyLinks'
import { SATELLITE_HASH, legacyStateNotice, satelliteNotice, stationResolvedMessage, type Notice } from '../../core/notices'
import { component } from '../component'
import { announce } from './live'

export function globalNotices() {
  return component({
    notices: [] as Notice[],

    init() {
      // Runs during Alpine.start(), after $store.url read the URL; it keeps
      // unknown keys, so `state` is removed here, directly.
      const legacy = legacyStateHash(location.search)
      const search = withoutLegacyState(location.search)
      if (search !== location.search) {
        history.replaceState(history.state, '', `${location.pathname}${search}${location.hash}`)
      }
      if (legacy) this.show(legacyStateNotice(legacy))

      // $store.url already routes #satellite to Now; make the address bar match.
      const checkSatellite = () => {
        if (location.hash !== SATELLITE_HASH) return
        history.replaceState(history.state, '', `${location.pathname}${location.search}#now`)
        this.show(satelliteNotice())
      }
      checkSatellite()
      window.addEventListener('hashchange', checkSatellite)

      // Settle once the catalog has loaded or failed: announce only if the
      // station store rewrote the page-load ?s= (never a later manual pick).
      const raw = Alpine.store('url').state.s
      let done = !raw
      Alpine.effect(() => {
        const status = Alpine.store('station').catalog?.status
        if (done || !status || status === 'loading') return
        done = true
        const msg = stationResolvedMessage(raw, Alpine.store('station').catalog?.data)
        if (msg) announce(msg)
      })
    },

    /** Add (or refresh) a banner and flash its toast. */
    show(n: Notice) {
      this.notices = [...this.notices.filter((x) => x.id !== n.id), n]
      MCO.showToast(n.toast)
    },

    /** Close a banner; focus moves to <main> so it isn't lost with the button. */
    dismiss(id: Notice['id']) {
      this.notices = this.notices.filter((x) => x.id !== id)
      document.getElementById('main')?.focus()
    },
  })
}
