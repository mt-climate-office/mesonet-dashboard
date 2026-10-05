// Station picker: editable WAI-ARIA combobox with list autocomplete (APG), best
// match highlighted; filtering in comboboxModel.ts. The field is a search box: it
// holds only the typed text (the selection shows elsewhere); × clears the text.
// Esc clears the text, then closes the list, then lets an enclosing dialog close. Options mirror the kit's
// planned MCO.initSearchBox({items, onSelect, …}) so it can be swapped in later.
//
// Markup (register with Alpine.data('combobox', combobox)):
//
//   <div class="ctl-combobox" x-data="combobox({ items: () => …, value: () => …,
//        onSelect: (id) => …, label: 'Station', placeholder: 'Search stations' })"
//        @focusout="onFocusOut($event)">
//     <label class="ctl-label" :id="ids.label" :for="ids.input" x-text="label"></label>
//     <div class="ctl-combobox-field">
//       <input x-ref="input" class="ctl-input" type="text" role="combobox"
//              autocomplete="off" spellcheck="false" aria-autocomplete="list"
//              :id="ids.input" :placeholder="placeholder" :aria-expanded="open"
//              :aria-controls="ids.listbox" :aria-activedescendant="activeId()"
//              :value="query" @input="onInput($event)"
//              @keydown="onKeydown($event)" @click="toggle()">
//       <button type="button" class="ctl-clear" x-show="hasText()"
//               :aria-label="'Clear ' + label" @click="clear()">&times;</button>
//     </div>
//     <div class="ctl-combobox-popup" x-show="open">
//       <div role="listbox" class="ctl-combobox-list" :id="ids.listbox"
//            :aria-labelledby="ids.label" x-show="result.total > 0">
//         <template x-for="group in result.groups" :key="group.name ?? ''">
//           <ul :role="group.name ? 'group' : 'presentation'"
//               :aria-labelledby="group.name ? groupId(group.name) : null">
//             <li role="presentation" class="ctl-combobox-group" x-show="group.name"
//                 :id="group.name ? groupId(group.name) : null" x-text="group.name"></li>
//             <template x-for="item in group.items" :key="item.id">
//               <li role="option" class="ctl-option" :id="optionId(item.id)"
//                   :aria-selected="isActive(item.id)" :class="{ 'is-current': isCurrent(item.id) }"
//                   @mousedown.prevent @click="select(item.id)">
//                 <span x-text="item.label"></span>
//                 <span class="ctl-option-meta" x-text="item.meta ?? item.id"></span>
//               </li>
//             </template>
//           </ul>
//         </template>
//       </div>
//       <p class="ctl-combobox-note" x-show="note()" x-text="note()"></p>
//     </div>
//     <div role="status" class="sr-only" x-text="status()"></div>
//   </div>

import { DEFAULT_LIMIT, escapeAction, filterItems, resultSummary, stepIndex, type ComboboxItem } from '../../core/controls/comboboxModel'
import { component } from '../component'
import { uniqueId } from './ids'

export type { ComboboxItem } from '../../core/controls/comboboxModel'

export interface ComboboxOptions {
  /** Every selectable item; read reactively, so it may fill in after load. */
  items: () => ComboboxItem[]
  /** Currently selected id, or null for none. */
  value: () => string | null
  /** Called with the chosen id. The caller updates `value`. */
  onSelect: (id: string) => void
  /** Visible label text; also names the listbox. */
  label: string
  placeholder?: string
  /** Max rendered options (default 200); the list says when more matched. */
  limit?: number
  /** Max options per results section (ComboboxItem `section`), e.g. { Places: 8 }. */
  sectionLimits?: Record<string, number>
}

/** Alpine.data factory for the combobox; see the markup in the file header. */
export function combobox(opts: ComboboxOptions) {
  const base = uniqueId('combobox')
  return component({
    label: opts.label,
    placeholder: opts.placeholder ?? '',
    ids: { label: `${base}-label`, input: `${base}-input`, listbox: `${base}-listbox` },
    open: false,
    /** The typed text (the input's value). */
    query: '',
    active: -1,

    get result() {
      return filterItems(opts.items(), this.query, opts.limit ?? DEFAULT_LIMIT, opts.sectionLimits)
    },

    /** The × shows whenever there is text to clear. */
    hasText(): boolean {
      return this.query !== ''
    },
    isCurrent(id: string): boolean {
      return opts.value() === id
    },
    isActive(id: string): boolean {
      return this.result.flat[this.active]?.id === id
    },
    optionId(id: string): string {
      return `${this.ids.listbox}-${id.replace(/[^\w-]/g, '_')}`
    },
    groupId(name: string): string {
      return `${this.ids.listbox}-g-${name.replace(/[^\w-]/g, '_')}`
    },
    activeId(): string | null {
      const item = this.result.flat[this.active]
      return this.open && item ? this.optionId(item.id) : null
    },
    /** Visible note under the list: empty state or truncation. */
    note(): string {
      const { flat, total } = this.result
      if (total === 0) return 'No matches'
      return flat.length < total ? `Showing ${flat.length} of ${total}; type to narrow` : ''
    },
    /** Polite status text; only while open so it doesn't chatter on load. */
    status(): string {
      return this.open ? resultSummary(this.result.flat.length, this.result.total) : ''
    },

    openList(at: 'current' | 'last' = 'current'): void {
      this.open = true
      const flat = this.result.flat
      const current = flat.findIndex((i) => i.id === opts.value())
      this.active = at === 'last' ? flat.length - 1 : Math.max(0, current)
      this.reveal()
    },
    close(): void {
      this.open = false
      this.query = ''
      this.active = -1
    },
    toggle(): void {
      if (this.open) this.close()
      else this.openList()
    },
    select(id: string): void {
      this.close()
      opts.onSelect(id)
    },
    /** × : empty the text, keep focus, show the full list. */
    clear(): void {
      this.query = ''
      this.$refs.input.focus()
      this.openList()
    },

    onInput(event: Event): void {
      this.query = (event.target as HTMLInputElement).value
      this.open = true
      this.active = this.result.best
      this.reveal()
    },
    onKeydown(event: KeyboardEvent): void {
      const n = this.result.flat.length
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp':
          event.preventDefault()
          if (!this.open) this.openList(event.key === 'ArrowUp' ? 'last' : 'current')
          else if (!event.altKey) this.active = stepIndex(this.active, event.key, n)
          break
        case 'Home':
        case 'End':
          // Only while navigating options; otherwise leave the text caret alone.
          if (!this.open || this.active < 0) return
          event.preventDefault()
          this.active = stepIndex(this.active, event.key, n)
          break
        case 'Enter': {
          const item = this.open ? this.result.flat[this.active] : undefined
          if (!item) return
          event.preventDefault()
          this.select(item.id)
          return
        }
        case 'Escape': {
          const action = escapeAction(this.query, this.open)
          if (action === 'pass') return // the enclosing dialog closes
          // Consumed here so an enclosing dialog doesn't also close.
          event.preventDefault()
          event.stopPropagation()
          if (action === 'clear') this.clear()
          else this.close()
          return
        }
        default:
          return
      }
      this.reveal()
    },
    onFocusOut(event: FocusEvent): void {
      if (!this.$el.contains(event.relatedTarget as Node | null)) this.close()
    },
    /** Scrolls the active option into view after Alpine renders. */
    reveal(): void {
      void this.$nextTick(() => {
        const id = this.activeId()
        if (id) document.getElementById(id)?.scrollIntoView({ block: 'nearest' })
      })
    },
  })
}
