/**
 * Typed `$store` / `Alpine.store(name)`: one entry per store registered in
 * main.ts. Add a line here when adding a store.
 */
import type { DataStore } from '../stores/data'
import type { StationStore } from '../stores/station'
import type { ThemeStore } from '../stores/theme'
import type { UrlStore } from '../stores/url'

declare module 'alpinejs' {
  interface Stores {
    url: UrlStore
    data: DataStore
    theme: ThemeStore
    station: StationStore
  }
}
