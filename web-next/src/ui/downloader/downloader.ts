/**
 * The Download sheet's form (`x-data="downloader"` in partials/downloader/index.html):
 * summary rows that expand in place, one primary button (Preview, then
 * Download CSV · N rows), the preview chart. Reads the URL and station stores;
 * the logic is core/downloader (form.ts, view.ts, request.ts).
 */
import Alpine from 'alpinejs'
import { getStationElements, type Station, type StationElement } from '../../core/api'
import type { Resource } from '../../core/cache'
import { downloaderPreviewChart, downloaderPreviewTable, previewHeight } from '../../core/charts'
import { toCsv } from '../../core/csv'
import * as form from '../../core/downloader/form'
import { prefillsFromChart } from '../../core/downloader/fromChart'
import { downloadFilename, fetchDownload, QC_LEVEL_OPTIONS, type DownloadQuery, type DownloadResult, type QcLevel } from '../../core/downloader/request'
import * as view from '../../core/downloader/view'
import { labelFor, type MultiselectGroup, type MultiselectOption } from '../../core/controls/multiselectModel'
import { buildPreviewModel, type PreviewModel } from '../../core/models/downloaderPreview'
import { denverToday } from '../../core/today'
import type { DlPeriod, UrlState } from '../../core/url-schema'
import { elementsResource } from '../charts/resources'
import { component } from '../component'
import { announce } from '../shell/live'

const HOUR = 60 * 60 * 1000

/**
 * The latest preview. Downloads deliberately bypass `$store.data`: every
 * Preview refetches, and only this one result is held.
 */
interface Run {
  query: DownloadQuery
  key: string
  status: 'loading' | 'success' | 'error'
  data: DownloadResult | null
  error: unknown
}

export function downloader() {
  // Preview model memo, keyed by the result object (rows can be large).
  let modelFor: DownloadResult | null = null
  let model: PreviewModel | null = null
  // Bumped per Preview and on a station change; a response from an older one is ignored.
  let gen = 0

  return component({
    run: null as Run | null,
    /** The open summary row (one at a time), or null. */
    openRow: null as form.FormRow | null,
    /** The date inputs' drafts are valid (dateRange `onValidity`). */
    rangeValid: true,
    confirmedKey: null as string | null,
    today: denverToday(),
    periodOptions: view.PERIOD_OPTIONS,
    qcOptions: QC_LEVEL_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
    monthlyNote: view.MONTHLY_NOTE,
    previewBuilder: downloaderPreviewChart,
    previewTable: downloaderPreviewTable,

    init() {
      // A station change (from the header) ignores any preview still in flight.
      this.$watch('stationId', () => void gen++)
    },

    get url(): UrlState { return this.$store.url.state },
    get stationId(): string | null { return this.$store.station.id },
    get station(): Station | undefined { return this.$store.station.current },
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
    get qcOption() { return QC_LEVEL_OPTIONS.find((o) => o.value === this.qc)! },
    get dates(): view.DateWindow {
      return view.dateWindow({ period: this.url.period, from: this.url.dl_from, to: this.url.dl_to, installDate: this.installDate, today: this.today })
    },

    /* Summary row values */
    get stationText(): string { return form.stationLine(this.station?.name, this.stationId ?? this.url.s) },
    get varsText(): string { return form.variablesSummary(this.pruned.selected.map((v) => labelFor(v, this.groups))) },
    get datesText(): string { return this.dates.error ? 'Invalid range' : form.dateRangeLabel(this.dates.start, this.dates.end) },
    get intervalText(): string { return this.periodOptions.find((o) => o.value === this.url.period)?.label ?? this.url.period },
    isOpen(row: form.FormRow): boolean { return this.openRow === row },
    toggleRow(row: form.FormRow) { this.openRow = this.openRow === row ? null : row },

    /* The request and the one button */
    get blocker(): string | null {
      return form.formBlocker({ station: this.stationId, elements: this.pruned.selected, dateError: this.dates.error, rangeValid: this.rangeValid })
    },
    /** The request the inputs describe, or null while they cannot run. */
    get query(): DownloadQuery | null {
      if (this.blocker) return null
      const w = this.dates
      return { station: this.stationId!, start: w.start, end: w.end, period: this.url.period, elements: this.pruned.selected, level: this.qc }
    },
    /** The preview belongs to the current inputs. */
    get current(): boolean { return !!this.run && !!this.query && this.run.key === form.queryKey(this.query) },
    get result(): DownloadResult | null { return this.current && this.run?.status === 'success' ? this.run.data : null },
    get needsConfirm(): boolean {
      return this.dates.largeHourly && this.confirmedKey !== view.confirmKey(this.stationId, this.dates, this.url.period)
    },
    largeHourlyText(): string { return view.largeHourlyText(this.dates.span, this.needsConfirm) },
    /** Preview waits (no reason line) while `?s=` is unconfirmed or the chart behind is about to prefill the form. */
    get resolving(): boolean {
      return form.formWaiting({
        catalogLoading: !!this.url.s && this.$store.station.catalog?.status === 'loading',
        prefillPending: prefillsFromChart(this.url) && elementsResource(this.stationId)?.status === 'loading',
      })
    },
    get action(): form.PrimaryAction {
      return form.primaryAction({
        blocker: this.resolving ? null : this.blocker,
        waiting: this.resolving,
        loading: this.loading,
        armed: this.dates.largeHourly && !this.needsConfirm,
        rows: this.result?.rows.length ?? null,
      })
    },

    get loading(): boolean { return this.current && this.run?.status === 'loading' },
    /** The fidelity driver and verify scripts find the button by these (scripts/fidelity/lib/drivers.mjs). */
    get actionTestId(): string { return this.action.kind === 'download' ? 'dl-download' : 'dl-run' },

    setRangeValid(v: boolean) { this.rangeValid = v },
    /** Show the date control's own error, except where the install-specific message replaces it. */
    showRangeError(): boolean { return !(this.dates.clamped && this.dates.error) },
    setElements(v: string[]) { this.$store.url.set({ els: v }) },
    setPeriod(v: string) { this.$store.url.set({ period: v as DlPeriod }) },
    setQc(v: string) { this.$store.url.set({ qc: Number(v) as QcLevel }) },
    setDates(r: { start: string; end: string }) { this.$store.url.set({ dl_from: r.start, dl_to: r.end }) },
    toggleUncommon(e: Event) { this.$store.url.set({ pub: (e.target as HTMLInputElement).checked }) },

    /** The button (and Enter in a field): Preview or Download, whichever it shows. */
    act() {
      if (this.action.disabled) return
      if (this.action.kind === 'download') this.download()
      else void this.preview()
    },

    async preview() {
      const query = this.query
      if (!query) return
      if (this.needsConfirm) {
        // The first click on a > 1-year hourly range arms it; the second runs it.
        this.confirmedKey = view.confirmKey(this.stationId, this.dates, this.url.period)
        return
      }
      const mine = ++gen
      const key = form.queryKey(query)
      this.run = { query, key, status: 'loading', data: null, error: null }
      announce(`Requesting ${query.period} data for ${this.station?.name ?? query.station}…`)
      try {
        const data = await fetchDownload(query)
        if (mine !== gen) return
        this.run = { query, key, status: 'success', data, error: null }
        announce(view.resultAnnouncement(data.rows.length, data.columns.length))
      } catch (error) {
        if (mine !== gen) return
        this.run = { query, key, status: 'error', data: null, error }
        announce('Request failed.')
      }
    },

    /** Save the current result as CSV, inside the click's user gesture. */
    download() {
      const r = this.result
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
    previewModel(): PreviewModel | null {
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
      const m = this.previewModel()
      return m ? `--chart-height:${previewHeight(m, false)}px;--chart-height-compact:${previewHeight(m, true)}px` : ''
    },
    /** Text in the preview area, or '' when the chart shows or there is no preview for these inputs. */
    previewStatus(): string {
      if (!this.current) return ''
      const s = this.run?.status
      if (s === 'loading') return 'Loading data…'
      if (s === 'error') return (this.run?.error as Error | undefined)?.message ?? 'Failed to fetch data.'
      // No rows: the reason under the button says so.
      return this.previewModel() || !this.result?.rows.length ? '' : 'No data for the current selection.'
    },
  })
}
