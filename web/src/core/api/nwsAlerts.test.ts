import { describe, expect, it } from 'vitest'
import { parseNwsAlerts } from './nwsAlerts'

const feature = (p: Record<string, unknown>) => ({
  properties: {
    id: 'urn:1',
    event: 'Winter Storm Warning',
    headline: 'Winter Storm Warning issued October 12',
    severity: 'Severe',
    status: 'Actual',
    messageType: 'Alert',
    onset: '2026-10-12T18:00:00-06:00',
    ends: '2026-10-14T06:00:00-06:00',
    description: '  * WHAT...Heavy snow.\n  Accumulations of 8 to 12\ninches.\n\n* WHERE...Gallatin County.\n ',
    instruction: null,
    ...p,
  },
})

describe('parseNwsAlerts', () => {
  it('reads the event, severity, Denver wall-clock times and the text unwrapped into paragraphs', () => {
    expect(parseNwsAlerts({ features: [feature({})] })).toEqual([
      {
        id: 'urn:1',
        event: 'Winter Storm Warning',
        headline: 'Winter Storm Warning issued October 12',
        severity: 'Severe',
        onset: Date.UTC(2026, 9, 12, 18),
        ends: Date.UTC(2026, 9, 14, 6),
        description: '* WHAT...Heavy snow. Accumulations of 8 to 12 inches.\n\n* WHERE...Gallatin County.',
        instruction: '',
      },
    ])
  })

  it('falls back to effective and expires; drops tests, cancellations and duplicates', () => {
    const alerts = parseNwsAlerts({
      features: [
        feature({ onset: null, effective: '2026-10-12T03:00:00-06:00', ends: null, expires: '2026-10-12T20:00:00-06:00' }),
        feature({ id: 'urn:2', onset: null, effective: '2026-10-12T03:00:00-06:00', ends: null, expires: '2026-10-12T20:00:00-06:00' }),
        feature({ id: 'urn:3', status: 'Test' }),
        feature({ id: 'urn:4', messageType: 'Cancel' }),
        feature({ id: 'urn:5', event: undefined }),
      ],
    })
    expect(alerts.map((a) => [a.id, a.onset, a.ends])).toEqual([['urn:1', Date.UTC(2026, 9, 12, 3), Date.UTC(2026, 9, 12, 20)]])
  })

  it('tolerates an empty or malformed response', () => {
    expect(parseNwsAlerts({ features: [] })).toEqual([])
    expect(parseNwsAlerts(null)).toEqual([])
    expect(parseNwsAlerts({})).toEqual([])
  })
})
