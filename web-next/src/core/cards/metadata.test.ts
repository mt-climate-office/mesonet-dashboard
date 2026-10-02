import { describe, expect, it } from 'vitest'
import type { Station } from '../api'
import { metadataRows, metersToFeet } from './metadata'

const station: Station = {
  station: 'acebozem',
  name: 'Bozeman Ag Research Center',
  date_installed: '2016-10-12',
  sub_network: 'HydroMet',
  longitude: -111.0,
  latitude: 45.67,
  elevation: 1442.3,
  county: 'Gallatin',
  mesowest_id: null,
  gwic_id: null,
  nwsli_id: 'ACEBO',
  has_swp: true,
  funded: true,
}

describe('metadataRows', () => {
  it('legacy rows and order, elevation round(m × 3.281)', () => {
    const rows = metadataRows(station, null)
    expect(rows.map((r) => r.label)).toEqual([
      'Station Name', 'Long Name', 'Date Installed', 'Sub Network', 'Longitude', 'Latitude', 'Elevation (ft)', 'County', 'NWSLI ID',
    ])
    expect(rows.find((r) => r.label === 'Elevation (ft)')?.value).toBe('4732')
    expect(rows.find((r) => r.label === 'Longitude')?.value).toBe('-111')
    expect(metersToFeet(1000)).toBe(3281)
  })
  it('inserts the one-pager link after Long Name', () => {
    const rows = metadataRows(station, 'https://v5.airtableusercontent.com/x')
    expect(rows[2]).toEqual({ label: 'Station One-Pager', value: 'Click to View', href: 'https://v5.airtableusercontent.com/x' })
  })
  it('missing values show a dash', () => {
    const rows = metadataRows({ ...station, date_installed: null, nwsli_id: null, county: '', elevation: NaN }, null)
    expect(rows.filter((r) => r.value === '—').map((r) => r.label)).toEqual(['Date Installed', 'Elevation (ft)', 'County', 'NWSLI ID'])
  })
})
