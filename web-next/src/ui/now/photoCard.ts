/**
 * `x-data="photoCard"`: Now's photos from the data2 archive only (core/photos, view model core/cards/photo).
 * The tile is a carousel of the newest frame of each direction (core/cards `photoSlides`; swipe, ‹ › or the
 * dots, ui/layout/carousel); a slide opens a kit dialog on that direction, with direction, day and time
 * pickers over the webp_large frames and "Download original". Closing the dialog drops the picks.
 */
import Alpine from 'alpinejs'
import { derivedKey, isRecentDay, knownFrames, noCameraImages, photoDay, photoMessage, photoMinDay, photoPick, photoSlides, photoState, photoTimeOptions, photoTitle, type PhotoPick, type PhotoStateInput } from '../../core/cards'
import { denverToday } from '../../core/today'
import { basename, framesFor, type PhotoFrame, type StationCamera } from '../../core/photos'
import type { SegmentedOption } from '../controls/segmented'
import type { SelectOption } from '../controls/timeSelect'
import { component } from '../component'
import { initCarousel, type Carousel } from '../layout/carousel'
import { initScrollFade } from '../layout/scrollFade'
import { confirmedDay, latestFrames, monthFrames, photoSchedule } from '../station/resources'

type Source = { status: 'loading' | 'success' | 'error'; data: PhotoFrame[] | undefined }

export function photoCard() {
  let modal: { open(): void } | null = null
  let carousel: Carousel | null = null
  let unfade: (() => void) | null = null
  // The dialog's WebP, fetched as a blob while it is shown (see download()).
  let blob: { url: string; data: Blob | null } | null = null
  return component({
    /** Dialog view state: open, and the picks (null = default: newest day, N, newest frame). */
    open: false,
    picked: null as string | null,
    direction: null as string | null,
    slot: null as number | null,
    /** The carousel slide in view. */
    slideIndex: 0,

    init() {
      // Picks belong to one station.
      this.$watch('$store.station.id', () => this.reset())
      this.$watch('shownUrl', (url: string | null) => {
        if (!url || blob?.url === url) return
        const mine: { url: string; data: Blob | null } = { url, data: null }
        blob = mine
        fetch(url)
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => void (mine.data = b))
          .catch(() => undefined)
      })
    },

    get station(): string | null {
      return Alpine.store('station').id
    },
    /** The station's name for titles and alt text (its id until the catalog confirms it). */
    get stationName(): string {
      return Alpine.store('station').current?.name ?? this.station ?? ''
    },
    get cam(): StationCamera | undefined {
      return this.station ? photoSchedule().data?.stations.get(this.station) : undefined
    },
    get today(): string {
      return denverToday()
    },
    get latest(): Source | null {
      const s = photoSchedule().data
      const cam = this.cam
      return s && cam && cam.currentViews.length ? latestFrames(s, cam) : null
    },
    get day(): string {
      return photoDay(this.picked, this.latest?.data, this.today)
    },

    /** Frames for the dialog's day: latest listings when recent, else the confirmed manifest day. */
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

    /** The tile: newest frame of the default direction, whatever the dialog shows. */
    get tile(): PhotoPick | null {
      const cam = this.cam
      if (!cam || !this.station) return null
      const day = photoDay(null, this.latest?.data, this.today)
      return photoPick({ station: this.stationName, cam, day, recent: isRecentDay(day, this.today), frames: this.latest?.data, direction: null, slotUtcMs: null })
    },
    /** The dialog's frame. */
    get pick(): PhotoPick | null {
      const cam = this.cam
      if (!cam || !this.station) return null
      const recent = isRecentDay(this.day, this.today)
      return photoPick({ station: this.stationName, cam, day: this.day, recent, frames: this.source?.data, direction: this.direction, slotUtcMs: this.slot })
    },

    /** The carousel: the newest frame of each direction, the default first. */
    get slides(): PhotoPick[] {
      const cam = this.cam
      if (!cam || !this.station) return []
      const day = photoDay(null, this.latest?.data, this.today)
      return photoSlides({ station: this.stationName, cam, day, recent: isRecentDay(day, this.today), frames: this.latest?.data, direction: null, slotUtcMs: null })
    },
    /** `x-init` on the carousel track (it mounts once the photos are ready). */
    mountCarousel(track: HTMLElement): void {
      carousel?.destroy()
      carousel = initCarousel({ track, onIndex: (i) => (this.slideIndex = i) })
    },
    step(dir: -1 | 1): void {
      carousel?.go(this.slideIndex + dir)
    },
    destroy() {
      carousel?.destroy()
      carousel = null
      unfade?.()
    },

    tileView(): PhotoStateInput {
      return { schedule: photoSchedule().status, cam: this.cam, source: this.latest, pick: this.tile }
    },
    dialogView(): PhotoStateInput {
      return { schedule: photoSchedule().status, cam: this.cam, source: this.source, pick: this.pick }
    },
    /** 'loading' | 'message' | 'ready' for the tile, and for the dialog (`state`). */
    get tileState() {
      return photoState(this.tileView())
    },
    get state() {
      return photoState(this.dialogView())
    },
    tileMessage(): string {
      return photoMessage(this.tileView())
    },
    message(): string {
      return photoMessage(this.dialogView())
    },
    /** Pickers show once the camera is known (even on an empty day). */
    get hasControls(): boolean {
      return !!this.station && photoSchedule().status === 'success' && !noCameraImages(this.cam)
    },
    /** The WebP the open dialog shows (prefetched for download()). */
    get shownUrl(): string | null {
      return this.open ? (this.pick?.active?.webpUrl ?? null) : null
    },

    minDay(): string | null {
      return this.cam ? photoMinDay(this.cam) : null
    },
    directionOptions(): SegmentedOption[] {
      const p = this.pick
      return p ? p.tokens.map((t) => ({ value: t, label: p.labels[t] ?? t })) : []
    },
    directionValue(): string {
      return this.pick?.direction ?? ''
    },
    timeOptions(): SelectOption[] {
      return photoTimeOptions(this.pick?.frames ?? [])
    },
    timeValue(): string {
      return this.pick?.active ? String(this.pick.active.slotUtcMs) : ''
    },
    title(): string {
      return photoTitle(this.stationName, this.pick)
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
    reset(): void {
      this.picked = this.direction = null
      this.slot = null
    },
    /** Open the dialog on `direction` (a carousel slide), else the default. */
    enlarge(direction?: string): void {
      // Wired on first use: x-ref children are not registered yet during init().
      if (!modal) {
        const dialog = this.$refs.dialog as HTMLDialogElement
        modal = MCO.initInfoModal({ dialog })
        unfade = initScrollFade(dialog.querySelector<HTMLElement>('.info-modal-box')!)
      }
      this.direction = direction ?? null
      this.open = true
      modal.open()
    },
    /** The dialog's `close` event (Esc, ×, backdrop): it reopens on the tile's frame. */
    closed(): void {
      this.open = false
      this.reset()
    },

    /** Archive basename of the shown WebP (the download file name). */
    fileName(): string {
      return this.pick?.active ? basename(this.pick.active.webpUrl) : ''
    },

    /**
     * "Download original" is `<a href=webp download=basename target=_blank>`. Browsers ignore
     * `download` cross-origin, so once the blob prefetched for the shown frame is ready it is saved from
     * an object URL, synchronously (no await, so the click's user gesture holds, e.g. in Safari).
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
