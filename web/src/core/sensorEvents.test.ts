import { describe, expect, it } from 'vitest'
import {
  buildSensorEvents,
  defaultEventWidth,
  denverNow,
  explodeInstruments,
  filterOutagesToMissingData,
  formatWallClock,
  metricNaIntervals,
  normalizeOutageRanges,
  parseWallClock,
  sensorEventText,
  sensorEventsForSubplot,
  type ConfigRow,
  type SensorEvent,
} from './sensorEvents'

const H = 3600_000
const t = (s: string) => parseWallClock(s)!
const row = (over: Partial<ConfigRow>): ConfigRow => ({
  element: 'Air Temperature [°F]',
  dateStart: null,
  dateEnd: null,
  outageRanges: [],
  ...over,
})

describe('time helpers', () => {
  it('parses dates and datetimes at their wall clock, ignoring offsets', () => {
    expect(formatWallClock(t('2026-09-24'))).toBe('2026-09-24 00:00:00')
    expect(formatWallClock(t('2026-09-28 13:15:00-06:00'))).toBe('2026-09-28 13:15:00')
    expect(formatWallClock(t('2026-09-28T13:15:00Z'))).toBe('2026-09-28 13:15:00')
    expect(parseWallClock('None')).toBeNull()
    expect(parseWallClock('')).toBeNull()
    expect(parseWallClock(null)).toBeNull()
    expect(parseWallClock(['2026-01-01'])).toBeNull()
  })
  it('denverNow reports the Denver wall clock', () => {
    // 2026-07-01 18:00Z is 12:00 MDT.
    expect(formatWallClock(denverNow(new Date('2026-07-01T18:00:00Z')))).toBe(
      '2026-07-01 12:00:00',
    )
    // 2026-01-15 19:30Z is 12:30 MST.
    expect(formatWallClock(denverNow(new Date('2026-01-15T19:30:00Z')))).toBe(
      '2026-01-15 12:30:00',
    )
  })
})

describe('normalizeOutageRanges', () => {
  it('keeps list-of-lists of non-blank strings', () => {
    expect(normalizeOutageRanges([['2024-05-01', '2024-05-03'], ['2024-05-18']])).toEqual([
      ['2024-05-01', '2024-05-03'],
      ['2024-05-18'],
    ])
    expect(normalizeOutageRanges([['2024-05-01', null, ''], [], 'x'])).toEqual([
      ['2024-05-01'],
    ])
  })
  it('parses Python reprs and rejects junk', () => {
    expect(normalizeOutageRanges("[['2024-05-01', None]]")).toEqual([['2024-05-01']])
    expect(normalizeOutageRanges('None')).toEqual([])
    expect(normalizeOutageRanges('not a list')).toEqual([])
    expect(normalizeOutageRanges(null)).toEqual([])
  })
})

describe('explodeInstruments', () => {
  it('explodes elements, maps labels and passes unknown codes through', () => {
    const rows = explodeInstruments([
      {
        date_start: '2021-10-05',
        date_end: 'None',
        elements: ['soil_vwc_0005', 'soil_temp_0005', 'soil_ec_por_0005'],
        outage_ranges: null,
      },
      { date_start: '2023-05-16', date_end: 'None', elements: 'door', outage_ranges: null },
    ])
    expect(rows.map((r) => r.element)).toEqual([
      'Soil VWC @ 2 in [%]',
      'Soil Temperature @ 2 in [°F]',
      'soil_ec_por_0005',
      'door',
    ])
    expect(rows[0].dateEnd).toBe('None')
  })
  it('splits parallel date arrays into deployments (blmrubyc shape)', () => {
    const rows = explodeInstruments([
      {
        date_start: ['2024-04-28', '2026-09-09'],
        date_end: ['2026-09-09', 'None'],
        elements: ['soil_vwc_0010'],
        outage_ranges: [['2026-01-01']],
      },
    ])
    expect(rows).toEqual([
      { element: 'Soil VWC @ 4 in [%]', dateStart: '2024-04-28', dateEnd: '2026-09-09', outageRanges: [] },
      {
        element: 'Soil VWC @ 4 in [%]',
        dateStart: '2026-09-09',
        dateEnd: 'None',
        outageRanges: [['2026-01-01']],
      },
    ])
  })
})

describe('buildSensorEvents', () => {
  const dataMin = t('2026-09-17 00:00')
  const dataMax = t('2026-10-01 00:00')
  const now = t('2026-10-01 09:00')
  const width = 6 * H

  it('adds +12 h added/removed events inside the window and groups elements', () => {
    const events = buildSensorEvents(
      [
        row({ element: 'Soil VWC @ 4 in [%]', dateStart: '2026-09-24', dateEnd: 'None' }),
        row({ element: 'Soil VWC @ 2 in [%]', dateStart: '2026-09-24', dateEnd: 'None' }),
        row({ element: 'Soil VWC @ 2 in [%]', dateStart: '2026-09-24' }),
        row({ element: 'Soil VWC @ 2 in [%]', dateStart: '2021-01-01', dateEnd: '2026-09-24' }),
        row({ element: 'Soil VWC @ 8 in [%]', dateStart: '2020-01-01' }),
      ],
      { dataMin, dataMax, defaultWidthMs: width, now },
    )
    expect(events).toEqual<SensorEvent[]>([
      {
        reason: 'added',
        x0: t('2026-09-24 12:00'),
        x1: t('2026-09-24 18:00'),
        elements: ['Soil VWC @ 2 in [%]', 'Soil VWC @ 4 in [%]'],
        openEnded: false,
      },
      {
        reason: 'removed',
        x0: t('2026-09-24 12:00'),
        x1: t('2026-09-24 18:00'),
        elements: ['Soil VWC @ 2 in [%]'],
        openEnded: false,
      },
    ])
  })

  it('treats an outage with no end as ongoing until now', () => {
    const [e] = buildSensorEvents(
      [row({ dateStart: '2020-01-01', outageRanges: [['2026-09-20']] })],
      { dataMin, dataMax, defaultWidthMs: width, now },
    )
    expect(e).toMatchObject({ reason: 'outage', x0: t('2026-09-20 12:00'), x1: now, openEnded: true })
  })

  it('closes an outage at its end date (+12 h)', () => {
    const [e] = buildSensorEvents(
      [row({ dateStart: '2020-01-01', outageRanges: [['2026-09-20', '2026-09-22']] })],
      { dataMin, dataMax, defaultWidthMs: width, now },
    )
    expect(e).toMatchObject({ x0: t('2026-09-20 12:00'), x1: t('2026-09-22 12:00'), openEnded: false })
  })

  it('ends an outage when its sensor is replaced (5afb746f)', () => {
    const events = buildSensorEvents(
      [row({ dateStart: '2020-01-01', dateEnd: '2026-09-25', outageRanges: [['2026-09-20']] })],
      { dataMin, dataMax, defaultWidthMs: width, now },
    )
    const outage = events.find((e) => e.reason === 'outage')!
    expect(outage).toMatchObject({ x0: t('2026-09-20 12:00'), x1: t('2026-09-25 12:00'), openEnded: false })
  })

  it('drops an outage that starts after its sensor was removed', () => {
    const events = buildSensorEvents(
      [row({ dateStart: '2020-01-01', dateEnd: '2026-09-18', outageRanges: [['2026-09-20']] })],
      { dataMin, dataMax, defaultWidthMs: width, now },
    )
    expect(events.map((e) => e.reason)).toEqual(['removed'])
  })

  it('widens zero-length outages to the default width', () => {
    const [e] = buildSensorEvents(
      [row({ dateStart: '2020-01-01', outageRanges: [['2026-09-20', '2026-09-20']] })],
      { dataMin, dataMax, defaultWidthMs: width, now },
    )
    expect(e.x1 - e.x0).toBe(width)
  })

  it('skips events outside the data window', () => {
    expect(
      buildSensorEvents(
        [row({ dateStart: '2026-05-01', dateEnd: '2026-06-01', outageRanges: [['2026-05-05', '2026-05-07']] })],
        { dataMin, dataMax, defaultWidthMs: width, now },
      ),
    ).toEqual([])
  })
})

describe('metricNaIntervals / filterOutagesToMissingData', () => {
  // Hourly samples 00:00..23:00 with data missing 05:00-07:00 and a dropped
  // stretch 12:00-15:00 (rows absent).
  const samples = Array.from({ length: 24 }, (_, h) => ({
    t: t(`2026-09-20 ${String(h).padStart(2, '0')}:00`),
    hasValue: !(h >= 5 && h <= 7),
  })).filter((_, h) => h < 12 || h > 15)

  it('finds null rows and dropped rows', () => {
    const spans = metricNaIntervals(samples, t('2026-09-20 00:00'), t('2026-09-20 23:00'))
    expect(spans.map(([a, b]) => [formatWallClock(a), formatWallClock(b)])).toEqual([
      ['2026-09-20 05:00:00', '2026-09-20 08:00:00'],
      ['2026-09-20 12:00:00', '2026-09-20 16:00:00'],
    ])
  })

  it('returns nothing when the data is complete', () => {
    const full = samples.map((s) => ({ ...s, hasValue: true })).slice(0, 10)
    expect(metricNaIntervals(full, t('2026-09-20 00:00'), t('2026-09-20 09:00'))).toEqual([])
  })

  it('splits an outage into its missing spans and clears open_ended unless it reaches the end', () => {
    const outage: SensorEvent = {
      reason: 'outage',
      x0: t('2026-09-20 03:00'),
      x1: t('2026-09-21 00:00'),
      elements: ['Air Temperature [°F]'],
      openEnded: true,
    }
    const added: SensorEvent = { ...outage, reason: 'added', openEnded: false }
    const out = filterOutagesToMissingData([outage, added], samples)
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({ x0: t('2026-09-20 05:00'), x1: t('2026-09-20 08:00'), openEnded: false })
    expect(out[1]).toMatchObject({ x0: t('2026-09-20 12:00'), x1: t('2026-09-20 16:00') })
    expect(out[2]).toBe(added)
  })
})

describe('sensorEventsForSubplot', () => {
  const rows = Array.from({ length: 48 }, (_, i) => {
    const d = new Date(t('2026-09-23 00:00') + i * H)
    const dt = `${formatWallClock(d.getTime())}-06:00`
    return {
      station: 'x',
      datetime: dt,
      'Soil VWC @ 2 in [%]': i >= 30 ? null : 20,
      'Soil VWC @ 4 in [%]': i >= 30 ? null : 22,
    }
  })
  const config = explodeInstruments([
    { date_start: '2026-09-24', date_end: 'None', elements: ['soil_vwc_0005', 'soil_temp_0005'] },
    { date_start: '2020-01-01', date_end: 'None', elements: ['soil_vwc_0010'], outage_ranges: [['2026-09-23']] },
    { date_start: '2026-09-24', date_end: 'None', elements: ['air_temp_0200'] },
  ])

  it('keeps only this subplot’s elements and clips outages to missing data', () => {
    const events = sensorEventsForSubplot({
      kind: 'soil',
      columns: ['Soil VWC @ 2 in [%]', 'Soil VWC @ 4 in [%]'],
      config,
      rows,
      now: t('2026-10-01 00:00'),
    })
    expect(events.map((e) => [e.reason, formatWallClock(e.x0), formatWallClock(e.x1), e.elements])).toEqual([
      ['added', '2026-09-24 12:00:00', '2026-09-24 18:00:00', ['Soil VWC @ 2 in [%]']],
      ['outage', '2026-09-24 06:00:00', '2026-09-24 23:00:00', ['Soil VWC @ 4 in [%]']],
    ])
  })

  it('returns nothing when no element matches', () => {
    expect(
      sensorEventsForSubplot({ kind: 'met', columns: ['Relative Humidity [%]'], config, rows }),
    ).toEqual([])
  })

  it('uses 48 h met events for windows longer than 31 days', () => {
    expect(defaultEventWidth('met', 0, 32 * 24 * H)).toBe(48 * H)
    expect(defaultEventWidth('met', 0, 31 * 24 * H)).toBe(6 * H)
    expect(defaultEventWidth('soil', 0, 90 * 24 * H)).toBe(6 * H)
  })
})

describe('sensorEventText', () => {
  const base: SensorEvent = {
    reason: 'added',
    x0: t('2026-09-24 12:00'),
    x1: t('2026-09-24 18:00'),
    elements: ['A', 'B'],
    openEnded: false,
  }
  it('matches the legacy wording', () => {
    expect(sensorEventText(base)).toBe(
      'A sensor was added/replaced on 2026-09-24, affecting the following elements:<br>A,<br>B',
    )
    expect(sensorEventText({ ...base, reason: 'removed' })).toBe(
      'A sensor was sunset/removed on 2026-09-24, affecting the following elements:<br>A,<br>B',
    )
    expect(sensorEventText({ ...base, reason: 'outage' })).toBe(
      'A sensor outage was reported on 2026-09-24, affecting the following elements:<br>A,<br>B',
    )
    expect(sensorEventText({ ...base, reason: 'outage', x1: t('2026-09-27 00:00') })).toBe(
      'A sensor outage was reported on 2026-09-24 and lasted through 2026-09-27, affecting the following elements:<br>A,<br>B',
    )
    expect(
      sensorEventText({ ...base, reason: 'outage', x1: t('2026-09-27 00:00'), openEnded: true }),
    ).toBe(
      'A sensor outage was reported on 2026-09-24 and is ongoing as of 2026-09-27, affecting the following elements:<br>A,<br>B',
    )
  })
})
