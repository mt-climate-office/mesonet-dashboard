/**
 * Download section: request controls, the preview chart and the CSV download
 * (`x-data="downloader"` in partials/downloader/index.html); a three-step
 * stepper on phones. Reads the URL and station stores; all request, view and
 * step logic is core/downloader.
 */
import Alpine from 'alpinejs'
import dayjs from 'dayjs'
import { getStationElements, type Station, type StationElement } from '../../core/api'
import type { Resource } from '../../core/cache'
import { downloaderPreviewChart, downloaderPreviewTable, previewHeight } from '../../core/charts'
import { toCsv } from '../../core/csv'
import { downloadFilename, fetchDownload, QC_LEVEL_OPTIONS, type DownloadQuery, type DownloadResult, type QcLevel } from '../../core/downloader/request'
import * as stepper from '../../core/downloader/stepper'
import * as view from '../../core/downloader/view'
import { buildPreviewModel, type PreviewModel } from '../../core/models/downloaderPreview'
import type { ComboboxItem } from '../../core/controls/comboboxModel'
import type { MultiselectGroup, MultiselectOption } from '../../core/controls/multiselectModel'
import type { DlPeriod, UrlState } from '../../core/url-schema'
import { component } from '../component'
import { announce } from '../shell/live'

const HOUR = 60 * 60 * 1000

/**
 * The latest Run. Downloads deliberately bypass `$store.data`: every Run
 * refetches, and only this one result is held (dropped on station change).
 */
interface Run {
  query: DownloadQuery
  status: 'loading' | 'success' | 'error'
  data: DownloadResult | null
  error: unknown
}

/** Scroll `box` to the top of the view (instantly under reduced motion), then focus `heading` without a second jump. */
function reveal(box: HTMLElement | undefined, heading: HTMLElement | undefined): void {
  box?.scrollIntoView({ block: 'start', behavior: MCO.reducedMotion() ? 'auto' : 'smooth' })
  heading?.focus({ preventScroll: true })
}

export function downloader() {
  // Preview model memo, keyed by the result object (rows can be large).
  let modelFor: DownloadResult | null = null
  let model: PreviewModel | null = null
  // Bumped per Run; a response from an older Run is ignored.
  let gen = 0

  return component({
    run: null as Run | null,
    /** Run / Download was clicked: from then on their guard messages track the inputs. */
    triedRun: false,
    triedDownload: false,
    /** The date inputs' drafts are valid (dateRange `onValidity`). */
    rangeValid: true,
    /** Phone stepper: the visible step (index into `steps`), and whether Next was tried on it. */
    step: 0,
    triedNext: false,
    steps: stepper.STEPS,
    confirmedKey: null as string | null,
    today: dayjs().format('YYYY-MM-DD'),
    periodOptions: view.PERIOD_OPTIONS,
    qcOptions: QC_LEVEL_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
    monthlyNote: view.MONTHLY_NOTE,
    previewBuilder: downloaderPreviewChart,
    previewTable: downloaderPreviewTable,

    init() {
      // A result belongs to its station: drop it when the station changes (here or on another tab).
      // The first resolution (null → deep-linked id) is not a change.
      this.$watch('stationId', (_id: string | null, old: string | null) => {
        if (old == null && !this.run) return
        gen++
        this.run = null
        this.triedRun = this.triedDownload = false
      })
    },

    get url(): UrlState { return this.$store.url.state },
    get stationId(): string | null { return this.$store.station.id },
    get station(): Station | undefined { return this.$store.station.current },
    get stationItems(): ComboboxItem[] { return view.stationItems(this.$store.station.list) },
    get installDate(): string | null { return view.installDateOf(this.station) },
    get hasSwp(): boolean { return this.station?.has_swp === true },

    /** "Show uncommon" off → public=true (common elements only), as legacy. */
    get elements(): Resource<StationElement[]> | null {
      const id = this.stationId
      if (!id) return null
      const publicOnly = !this.url.pub
      return this.$store.data.cached(`station-elements:${id}:public=${publicOnly}`, () => getStationElements(id, publicOnly), { ttl: HOUR })
    },
    get standard(): MultiselectOption[] | null {
      const d = this.elements?.data
      return d ? view.standardOptions(d) : null
    },
    get groups(): MultiselectGroup[] { return this.stationId ? view.elementGroups(this.standard ?? [], this.hasSwp) : [] },
    get pruned(): { selected: string[]; droppedSwp: string[] } {
      return view.pruneSelection(this.url.els, { stationKnown: !!this.station, hasSwp: this.hasSwp, standard: this.standard })
    },
    get droppedNotice(): string {
      const d = this.pruned.droppedSwp
      return d.length ? view.droppedSwpNotice(d, this.station?.name ?? this.url.s ?? '') : ''
    },
    get qc(): QcLevel { return view.qcLevelOf(this.url.qc, this.url.rmna) },
    get qcDescription(): string { return QC_LEVEL_OPTIONS.find((o) => o.value === this.qc)!.description },
    get dates(): view.DateWindow {
      return view.dateWindow({ period: this.url.period, from: this.url.dl_from, to: this.url.dl_to, installDate: this.installDate, today: this.today })
    },
    get needsConfirm(): boolean {
      return this.dates.largeHourly && this.confirmedKey !== view.confirmKey(this.stationId, this.dates, this.url.period)
    },
    largeHourlyText(): string { return view.largeHourlyText(this.dates.span, this.needsConfirm) },
    get runLabel(): string { return this.dates.largeHourly && !this.needsConfirm ? 'Confirm large request' : 'Run Request' },
    get loading(): boolean { return this.run?.status === 'loading' },
    /** `?s=` is set but the catalog has not confirmed it yet: Run waits rather than saying "pick a station". */
    get resolving(): boolean { return !!this.url.s && this.$store.station.catalog?.status === 'loading' },
    get result(): DownloadResult | null { return this.run?.status === 'success' ? this.run.data : null },
    get hasRows(): boolean { return (this.result?.rows.length ?? 0) > 0 },
    /** Why Run cannot start, recomputed as the inputs change (null = it can). */
    get blocker(): string | null { return view.runBlocker(this.stationId, this.pruned.selected, this.dates.error) },
    /** Message under Run: shown once Run/Download was tried, cleared as soon as it no longer applies. */
    get hint(): string | null {
      if (this.triedRun && this.blocker) return this.blocker
      if (this.triedDownload && !this.hasRows && !this.loading) return view.RUN_FIRST_HINT
      return null
    },

    get stepInputs(): stepper.StepInputs {
      return { station: this.stationId, elements: this.pruned.selected, dateError: this.dates.error, rangeValid: this.rangeValid }
    },
    /** Message under Next: shown once Next was tried on this step, cleared as soon as it no longer applies. */
    get stepHint(): string | null { return this.triedNext ? stepper.stepBlocker(this.step, this.stepInputs) : null },
    get progress(): string { return stepper.progressText(this.step) },
    get summary(): string[] {
      const w = this.dates
      return view.requestSummary({ station: this.station?.name ?? this.url.s ?? '', elements: this.pruned.selected.length, period: this.url.period, start: w.start, end: w.end })
    },

    next() {
      this.triedNext = true
      const to = stepper.nextStep(this.step, this.stepInputs)
      if (to !== this.step) this.showStep(to)
    },
    back() { this.showStep(stepper.prevStep(this.step)) },
    /** Show step `i`: bring the stepper's top into view, focus the step heading, announce it. */
    showStep(i: number) {
      this.step = i
      this.triedNext = false
      announce(stepper.stepAnnouncement(i))
      void this.$nextTick(() => reveal(this.$refs.progress, this.$refs[`step${i}`]))
    },
    /** Enter in a field: Next on a phone's earlier steps, otherwise Run. */
    submit() {
      if (MCO.viewport.isCompact() && this.step < stepper.LAST_STEP) this.next()
      else void this.runRequest()
    },

    pickStation(id: string | null) { this.$store.url.set(view.stationPatch(id)) },
    setRangeValid(v: boolean) { this.rangeValid = v },
    /** Show the date control's own error, except where the install-specific message replaces it. */
    showRangeError(): boolean { return !(this.dates.clamped && this.dates.error) },
    setElements(v: string[]) { this.$store.url.set({ els: v }) },
    setPeriod(v: string) { this.$store.url.set({ period: v as DlPeriod }) },
    setQc(v: string) { this.$store.url.set({ qc: Number(v) as QcLevel }) },
    setDates(r: { start: string; end: string }) { this.$store.url.set({ dl_from: r.start, dl_to: r.end }) },
    toggleUncommon(e: Event) { this.$store.url.set({ pub: (e.target as HTMLInputElement).checked }) },

    async runRequest() {
      const w = this.dates
      this.triedRun = true
      if (this.blocker || !this.rangeValid) return
      if (this.needsConfirm) {
        // First click on a > 1-year hourly range arms it; the second runs it.
        this.confirmedKey = view.confirmKey(this.stationId, w, this.url.period)
        return
      }
      const query: DownloadQuery = {
        station: this.stationId!,
        start: w.start,
        end: w.end,
        period: this.url.period,
        elements: this.pruned.selected,
        level: this.qc,
      }
      const mine = ++gen
      this.run = { query, status: 'loading', data: null, error: null }
      this.triedDownload = false
      announce(`Requesting ${query.period} data for ${this.station?.name ?? query.station}…`)
      try {
        const data = await fetchDownload(query)
        if (mine !== gen) return
        this.run = { query, status: 'success', data, error: null }
        announce(view.resultAnnouncement(data.rows.length, data.columns.length))
      } catch (error) {
        if (mine !== gen) return
        this.run = { query, status: 'error', data: null, error }
        announce('Request failed.')
      }
      // The result can be below the fold (always on phones): bring it up and focus its heading.
      void this.$nextTick(() => reveal(this.$refs.preview, this.$refs.previewTitle))
    },

    download() {
      const r = this.result
      this.triedDownload = true
      if (!this.run || !r || r.rows.length === 0) return
      const q = this.run.query
      const blob = new Blob([toCsv(Alpine.raw(r.rows), r.columns)], { type: 'text/csv;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = downloadFilename(q.station, q.period, q.start, q.end)
      document.body.append(a)
      a.click()
      a.remove()
      // Some browsers start reading the blob after click() returns; keep the URL alive a while.
      setTimeout(() => URL.revokeObjectURL(href), 10_000)
    },

    /** Preview model for the chart host (null clears it). */
    preview(): PreviewModel | null {
      const r = this.result
      if (!r || !this.run) return null
      const raw = Alpine.raw(r)
      if (raw !== modelFor) {
        modelFor = raw
        model = buildPreviewModel(raw.rows, this.run.query.period)
      }
      return model
    },
    previewStyle(): string {
      const m = this.preview()
      return m ? `--chart-height:${previewHeight(m, false)}px;--chart-height-compact:${previewHeight(m, true)}px` : ''
    },
    /** Placeholder text for the preview area, or '' when the chart shows. */
    previewStatus(): string {
      const s = this.run?.status
      if (!s) return 'Configure the request and click Run Request to preview your data.'
      if (s === 'loading') return 'Loading data…'
      if (s === 'error') return (this.run?.error as Error | undefined)?.message ?? 'Failed to fetch data.'
      return this.preview() ? '' : 'No data for the current selection.'
    },
  })
}
