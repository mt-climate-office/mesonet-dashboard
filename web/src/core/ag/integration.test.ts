/**
 * A↔B integration: the compute library (A) fed by the data layer's vendored
 * stage tables (B) must label stages exactly as it does with the test tables
 * derived from the API sources. Guards the `stage` / `code` contract split.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { gdd } from './compute'
import { parseGddStagesJson } from './data/gddStages'
import { dailyMet, stageTable } from './__tests__/adapters'
import type { GddCrop } from './contract'

const vendored = parseGddStagesJson(
  JSON.parse(readFileSync(new URL('../../../public/data/gdd_stages.json', import.meta.url), 'utf8')),
  'vendored',
)

const CROPS: GddCrop[] = ['wheat', 'barley', 'canola', 'corn', 'sugarbeet', 'sunflower', 'hemp']

describe('compute × vendored GDD stage tables', () => {
  const met = dailyMet('acebozem', 'season2025')

  for (const crop of CROPS) {
    it(`${crop}: same stages as the API-derived test table`, () => {
      const ours = gdd(met, { crop, stages: vendored.tables[crop] })
      const ref = gdd(met, { crop, stages: stageTable(crop) })
      expect(ours.cumulative).toEqual(ref.cumulative)
      expect(ours.stageName).toEqual(ref.stageName)
      // Hemp's first stage id differs between the DB ("BBCH Stage 11") and
      // write_hemp_table.sql ("BBCH Stages 0-11"); see DIVERGENCES D-GDD-4.
      const norm = (s: unknown) =>
        crop === 'hemp' && typeof s === 'string' ? s.replace(/^BBCH Stages? (0-)?11$/, 'BBCH 11') : s
      expect(ours.stage.map(norm)).toEqual(ref.stage.map(norm))
    })
  }
})
