/**
 * `x-data="photoCard"`: Latest Photo from the data2 archive only (core/photos,
 * view model core/cards/photo). Direction chips, a day picker and a time
 * select of the frames that exist; the webp_large image opens a kit dialog
 * with "Download original" (the same WebP, saved under its basename).
 */
import Alpine from 'alpinejs'
import { derivedKey, isRecentDay, knownFrames, noCameraImages, photoDay, photoMinDay, photoPick, photoTimeOptions, type PhotoPick } from '../../../core/cards'
import { basename, framesFor, localToday, type PhotoFrame, type StationCamera } from '../../../core/photos'
import type { SelectOption } from '../../controls/timeSelect'
import { component } from '../../component'
import { confirmedDay, latestFrames, monthFrames, photoSchedule } from './resources'

type Source = { status: 'loading' | 'success' | 'error'; data: PhotoFrame[] | undefined }

export function photoCard() {
  let modal: { open(): void } | null = null
  // The shown WebP, fetched as a blob when the dialog opens (see download()).
  let blob: { url: string; data: Blob | null } | null = null
  return component({
    picked: null as string | null,
    direction: null as string | null,
    slot: null as number | null,

    init() {
      // Picks belong to one station.
      this.$watch('$store.station.id', () => {
        this.picked = this.direction = null
        this.slot = null
      })
    },

    get station(): string | null {
      return Alpine.store('station').id
    },
    get cam(): StationCamera | undefined {
      return this.station ? photoSchedule().data?.stations.get(this.station) : undefined
    },
    get today(): string {
      return localToday()
    },
    get latest(): Source | null {
      const s = photoSchedule().data
      const cam = this.cam
      return s && cam && cam.currentViews.length ? latestFrames(s, cam) : null
    },
    get day(): string {
      return photoDay(this.picked, this.latest?.data, this.today)
    },

    /** Frames for the shown day: latest listings when recent, else the confirmed manifest day. */
    get source(): Source | null {
      if (isRecentDay(this.day, this.today)) return this.latest
      const s = photoSchedule().data
      const cam = this.cam
      if (!s || !cam) return null
      const month = monthFrames(s, cam, this.day.slice(0, 7))
      if (!month.data) return { status: month.status, data: undefined }
      const frames = framesFor(month.data, this.day)
      const key = derivedKey(frames)
      if (!key) return { status: 'success', data: frames }
      // Until (or unless) the derived WebPs are confirmed, show the frames whose WebP the manifest names.
      const conf = confirmedDay(s, cam, this.day, key, frames)
      return conf.data ? conf : { status: conf.status === 'loading' ? 'success' : 'error', data: knownFrames(frames) }
    },

    get pick(): PhotoPick | null {
      const cam = this.cam
      if (!cam || !this.station) return null
      const recent = isRecentDay(this.day, this.today)
      return photoPick({ station: this.station, cam, day: this.day, recent, frames: this.source?.data, direction: this.direction, slotUtcMs: this.slot })
    },

    /** What the body shows; `message()` gives the text for the non-image states. */
    get state(): 'none' | 'loading' | 'message' | 'ready' {
      if (!this.station) return 'none'
      const sched = photoSchedule()
      if (sched.status === 'loading') return 'loading'
      if (sched.status === 'error' || noCameraImages(this.cam)) return 'message'
      const src = this.source
      if (!src || (src.status === 'loading' && !src.data)) return 'loading'
      return this.pick?.active ? 'ready' : 'message'
    },
    message(): string {
      if (photoSchedule().status === 'error') return 'Camera schedule unavailable.'
      if (noCameraImages(this.cam)) return 'No camera images are available for this station.'
      if (this.source?.status === 'error') return 'Camera images could not be loaded.'
      const p = this.pick
      return `No camera images are available for ${p ? p.label : 'this view'} on this date.`
    },
    /** Pickers show once the camera is known (even on an empty day). */
    get hasControls(): boolean {
      return !!this.station && photoSchedule().status === 'success' && !noCameraImages(this.cam)
    },

    minDay(): string | null {
      return this.cam ? photoMinDay(this.cam) : null
    },
    timeOptions(): SelectOption[] {
      return photoTimeOptions(this.pick?.frames ?? [])
    },
    timeValue(): string {
      return this.pick?.active ? String(this.pick.active.slotUtcMs) : ''
    },
    title(): string {
      const p = this.pick
      return p ? `${this.station} · ${p.label}${p.stamp ? ` · ${p.stamp}` : ''}` : ''
    },

    selectDay(d: string): void {
      this.picked = d
      this.slot = null
    },
    selectDirection(t: string): void {
      this.direction = t
    },
    selectTime(v: string): void {
      this.slot = Number(v)
    },
    enlarge(): void {
      // Wired on first use: x-ref children are not registered yet during init().
      modal ??= MCO.initInfoModal({ dialog: this.$refs.dialog as HTMLDialogElement })
      modal.open()
      const url = this.pick?.active?.webpUrl
      if (!url || blob?.url === url) return
      const mine: { url: string; data: Blob | null } = { url, data: null }
      blob = mine
      fetch(url)
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => void (mine.data = b))
        .catch(() => undefined)
    },

    /** Archive basename of the shown WebP (the download file name). */
    fileName(): string {
      return this.pick?.active ? basename(this.pick.active.webpUrl) : ''
    },

    /**
     * "Download original" is `<a href=webp download=basename target=_blank>`. Browsers ignore
     * `download` cross-origin, so once the blob prefetched by enlarge() is ready it is saved from an
     * object URL, synchronously (no await, so the click's user gesture holds, e.g. in Safari).
     * Otherwise the link's default runs and opens the WebP in a new tab.
     */
    download(e: Event): void {
      const url = this.pick?.active?.webpUrl
      if (!url || blob?.url !== url || !blob.data) return
      e.preventDefault()
      const href = URL.createObjectURL(blob.data)
      const a = Object.assign(document.createElement('a'), { href, download: basename(url) })
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 5_000)
    },
  })
}
