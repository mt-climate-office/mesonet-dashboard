// Boot for the map demo page (demo.html, not in the app build): a tiny demo
// store over the live /stations API, the two map presets, and a theme switch
// through MCO.setTheme, which fires the kit's mco:themechange as $store.theme does.
import Alpine from 'alpinejs'
import { getStations, type Station } from '../../core/api'
import { isTheme, type Theme } from '../../core/theme'
import { stationMap } from './presets'
import './map.css'

const params = new URLSearchParams(location.search)
const initial = params.get('theme')
if (isTheme(initial)) MCO.setTheme(initial, { persist: false })

// ?fixture=xss: markup in a station name must render as text in every twin.
const XSS_NAME = '<b>Bold</b><img src=x onerror="window.__xss=1">'

const demo = {
  status: 'loading',
  themes: ['dark', 'light', 'high-contrast'] as Theme[],
  theme: MCO.getTheme(),
  networks: ['HydroMet', 'AgriMet'],
  off: [] as string[],
  stations: [] as Station[],
  selected: null as string | null,

  get sorted(): Station[] {
    return [...this.stations].sort((a, b) => a.name.localeCompare(b.name))
  },
  /** null = every station; otherwise the ids whose network is on. */
  get visible(): string[] | null {
    if (this.off.length === 0) return null
    return this.stations.filter((s) => !this.off.includes(s.sub_network)).map((s) => s.station)
  },
  netOn(n: string) {
    return !this.off.includes(n)
  },
  toggleNet(n: string) {
    this.off = this.netOn(n) ? [...this.off, n] : this.off.filter((x) => x !== n)
  },
  select(id: string | null) {
    this.selected = id
  },
  setTheme(t: Theme) {
    MCO.setTheme(t, { persist: false })
    this.theme = t
  },
}
Alpine.store('demo', demo)

Alpine.data('stationMap', stationMap)

// Write through the reactive proxy so the page updates.
const live = Alpine.store('demo') as unknown as typeof demo
getStations()
  .then((rows) => {
    if (params.get('fixture') === 'xss') rows = rows.map((s) => (s.station === 'aceabsar' ? { ...s, name: XSS_NAME } : s))
    live.stations = rows
    live.selected = params.get('s')
    live.status = `${rows.length} stations`
  })
  .catch((e: unknown) => {
    live.status = `error: ${String(e)}`
  })

// Test hooks: record each map so Playwright can read layer ids and project points. MapLibre 6's module
// namespace is read-only, so the page's `maplibregl` global becomes a copy with a recording Map.
const maps: InstanceType<typeof maplibregl.Map>[] = []
const ns = await MCO.map.loadMapLibre()
class RecordedMap extends ns.Map {
  constructor(options: ConstructorParameters<typeof ns.Map>[0]) {
    super(options)
    maps.push(this)
  }
}
Object.assign(window, { maplibregl: { ...ns, Map: RecordedMap } })
Object.assign(window, {
  Alpine,
  __mapLayers: () => maps.map((m) => (m.getStyle()?.layers ?? []).map((l) => l.id)),
  __jump: (i: number, lng: number, lat: number, zoom: number) => maps[i].jumpTo({ center: [lng, lat], zoom }),
  __project: (i: number, lng: number, lat: number) => {
    const m = maps[i]
    const p = m.project([lng, lat])
    const r = m.getCanvas().getBoundingClientRect()
    return { x: r.left + p.x, y: r.top + p.y }
  },
})
Alpine.start()
