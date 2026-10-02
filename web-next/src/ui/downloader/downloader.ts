/**
 * Data Downloader tab: request controls, the preview chart and the CSV
 * download (`x-data="downloader"` in partials/downloader/index.html). Reads
 * the URL and station stores; all request and view logic is core/downloader.
 */
import Alpine from 'alpinejs'
import dayjs from 'dayjs'
import { getStationElements, type Station, type StationElement } from '../../core/api'
import type { Resource } from '../../core/cache'
import { downloaderPreviewChart, downloaderPreviewTable, previewHeight } from '../../core/charts'
import { toCsv } from '../../core/csv'
import { downloadFilename, fetchDownload, QC_LEVEL_OPTIONS, type DownloadQuery, type DownloadResult, type QcLevel } from '../../core/downloader/request'
import * as view from '../../core/downloader/view'
import { buildPreviewModel, type PreviewModel } from '../../core/models/downloaderPreview'
import type { ComboboxItem } from '../../core/controls/comboboxModel'
import type { MultiselectGroup, MultiselectOption } from '../../core/controls/multiselectModel'
import type { DlPeriod, UrlState } from '../../core/url-schema'
import { component } from '../component'
import { announce } from '../shell/live'

const HOUR = 60 * 60 * 1000

/** The last Run: its query and the cached request behind it. */
interface Run {
  query: DownloadQuery
  res: Resource<DownloadResult>
}

export function downloader() {
  // Preview model memo, keyed by the result object (rows can be large).
  let modelFor: DownloadResult | null = null
  let model: PreviewModel | null = null

  return component({
    run: null as Run | null,
    hint: null as string | null,
    confirmedKey: null as string | null,
    today: dayjs().format('YYYY-MM-DD'),
    periodOptions: view.PERIOD_OPTIONS,
    qcOptions: QC_LEVEL_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
    monthlyNote: view.MONTHLY_NOTE,
    previewBuilder: downloaderPreviewChart,
    previewTable: downloaderPreviewTable,

    init() {
      // Announce when the current run settles (canvas output is invisible to screen readers).
      this.$watch('run?.res.status', (s: string | undefined) => {
        const r = this.run?.res
        if (s === 'success' && r?.data) announce(view.resultAnnouncement(r.data.rows.length, r.data.columns.length))
        if (s === 'error') announce('Request failed.')
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
    get loading(): boolean { return this.run?.res.status === 'loading' },
    /** `?s=` is set but the catalog has not confirmed it yet: Run waits rather than saying "pick a station". */
    get resolving(): boolean { return !!this.url.s && this.$store.station.catalog?.status === 'loading' },
    get result(): DownloadResult | null { return this.run?.res.status === 'success' ? (this.run.res.data ?? null) : null },
    get hasRows(): boolean { return (this.result?.rows.length ?? 0) > 0 },

    pickStation(id: string | null) { this.$store.url.set(view.stationPatch(id)) },
    setElements(v: string[]) { this.$store.url.set({ els: v }) },
    setPeriod(v: string) { this.$store.url.set({ period: v as DlPeriod }) },
    setQc(v: string) { this.$store.url.set({ qc: Number(v) as QcLevel }) },
    setDates(r: { start: string; end: string }) { this.$store.url.set({ dl_from: r.start, dl_to: r.end }) },
    toggleUncommon(e: Event) { this.$store.url.set({ pub: (e.target as HTMLInputElement).checked }) },

    runRequest() {
      const w = this.dates
      this.hint = view.runBlocker(this.stationId, this.pruned.selected, w.error)
      if (this.hint) return
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
      const res = this.$store.data.cached(view.requestKey(query), () => fetchDownload(query))
      if (res.status === 'error') res.refresh()
      this.run = { query, res }
      announce(`Requesting ${query.period} data for ${this.station?.name ?? query.station}…`)
      if (res.status === 'success' && res.data) announce(view.resultAnnouncement(res.data.rows.length, res.data.columns.length))
    },

    download() {
      const r = this.result
      if (!this.run || !r || r.rows.length === 0) {
        this.hint = view.RUN_FIRST_HINT
        return
      }
      this.hint = null
      const q = this.run.query
      const blob = new Blob([toCsv(Alpine.raw(r.rows), r.columns)], { type: 'text/csv;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = downloadFilename(q.station, q.period, q.start, q.end)
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 0)
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
      const s = this.run?.res.status
      if (!s) return 'Configure the request and click Run Request to preview your data.'
      if (s === 'loading') return 'Loading data…'
      if (s === 'error') return (this.run?.res.error as Error | undefined)?.message ?? 'Failed to fetch data.'
      return this.preview() ? '' : 'No data for the current selection.'
    },
  })
}
