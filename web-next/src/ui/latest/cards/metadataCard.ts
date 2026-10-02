/**
 * `x-data="metadataCard"`: the selected station's catalog row as legacy
 * metadata rows (core/cards/metadata), with the one-pager link when listed.
 */
import Alpine from 'alpinejs'
import { findOnePager, metadataRows, type MetadataRow } from '../../../core/cards'
import { component } from '../../component'
import { onePagers } from '../../station/resources'

export function metadataCard() {
  return component({
    get state(): 'none' | 'loading' | 'failed' | 'missing' | 'ready' {
      const st = Alpine.store('station')
      if (!Alpine.store('url').state.s) return 'none'
      if (st.catalog?.status === 'loading') return 'loading'
      if (st.catalog?.status === 'error' && !st.catalog.data) return 'failed'
      return st.current ? 'ready' : 'missing'
    },

    get rows(): MetadataRow[] {
      const s = Alpine.store('station').current
      return s ? metadataRows(s, findOnePager(onePagers().data, s.station)) : []
    },
  })
}
