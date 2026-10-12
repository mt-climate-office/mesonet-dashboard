// Grouped multiselect: disclosure button over checkbox fieldsets with a filter
// box and per-group "Select all" (mixed state), plus removable chips for the
// selection. Pure logic in multiselectModel.ts and selectionModel.ts.
//
// Markup (register with Alpine.data('multiselect', multiselect)):
//
//   <div class="ctl-multiselect" x-data="multiselect({ groups: () => …,
//        value: () => …, onChange: (values) => …, label: 'Elements' })">
//     <button type="button" class="nav-btn ctl-disclosure" :id="ids.button"
//             :aria-expanded="open" :aria-controls="ids.panel" @click="toggle()">
//       <span x-text="label"></span><span class="ctl-count" x-text="countText()"></span>
//     </button>
//     <ul x-ref="chips" class="ctl-chip-list" :aria-label="'Selected ' + label" x-show="selected().length > 0">
//       <template x-for="v in selected()" :key="v">
//         <li><button type="button" class="nav-btn ctl-chip" :aria-label="'Remove ' + labelOf(v)"
//                     @click="remove(v, $event)"><span x-text="labelOf(v)"></span>
//             <span aria-hidden="true">&times;</span></button></li>
//       </template>
//     </ul>
//     <div class="ctl-multiselect-panel" role="group" :id="ids.panel"
//          :aria-labelledby="ids.button" x-show="open" @keydown.escape.prevent.stop="escape()">
//       <label class="ctl-label" :for="ids.filter">Filter</label>
//       <input type="search" class="ctl-input" :id="ids.filter" x-model="query" autocomplete="off">
//       <template x-for="group in visibleGroups" :key="group.id">
//         <fieldset class="ctl-fieldset">
//           <legend class="ctl-legend" x-text="group.label"></legend>
//           <label class="ctl-check ctl-check-all">
//             <input type="checkbox" :checked="stateOf(group) === 'all'"
//                    x-effect="markMixed($el, group)" @change="setGroup(group, $event)">
//             <span>Select all</span></label>
//           <template x-for="opt in group.options" :key="opt.value">
//             <label class="ctl-check">
//               <input type="checkbox" :checked="isSelected(opt.value)" @change="toggleValue(opt.value)">
//               <span x-text="opt.label"></span></label>
//           </template>
//         </fieldset>
//       </template>
//       <p class="ctl-note" x-show="visibleGroups.length === 0">No matches</p>
//     </div>
//   </div>
//
// With `inline: true` the checklist is always shown (no disclosure button: drop it from the markup and
// label the panel with `:aria-label="label"`), for a place that is itself a disclosure (the Download
// sheet's Variables row). Bind Esc as `@keydown.escape="escape($event)"` there: the first Esc clears
// the filter, the next goes on to the enclosing dialog.

import { component } from '../component'
import { uniqueId } from './ids'
import { filterGroups, groupState, labelFor, optionValues, type GroupState, type MultiselectGroup } from '../../core/controls/multiselectModel'
import { inOrder, setIn, toggleIn } from '../../core/controls/selectionModel'

export type { MultiselectGroup, MultiselectOption } from '../../core/controls/multiselectModel'

export interface MultiselectOptions {
  groups: () => MultiselectGroup[]
  /** Selected option values. */
  value: () => string[]
  /** Called with the new selection in option order. The caller updates `value`. */
  onChange: (values: string[]) => void
  /** Disclosure button text, e.g. "Elements". */
  label: string
  /** Always open, with no disclosure button (see the header). */
  inline?: boolean
}

/** Alpine.data factory for the multiselect; see the markup in the file header. */
export function multiselect(opts: MultiselectOptions) {
  const base = uniqueId('multiselect')
  return component({
    label: opts.label,
    ids: { button: `${base}-button`, panel: `${base}-panel`, filter: `${base}-filter` },
    open: !!opts.inline,
    query: '',

    get visibleGroups(): MultiselectGroup[] {
      return filterGroups(opts.groups(), this.query)
    },
    selected(): string[] {
      return inOrder(opts.value(), optionValues(opts.groups()))
    },
    isSelected(value: string): boolean {
      return opts.value().includes(value)
    },
    labelOf(value: string): string {
      return labelFor(value, opts.groups())
    },
    countText(): string {
      const n = opts.value().length
      return n === 0 ? 'None selected' : `${n} selected`
    },
    /** Select-all state over the group's currently visible (filtered) options. */
    stateOf(group: MultiselectGroup): GroupState {
      return groupState(group.options.map((o) => o.value), opts.value())
    },
    /** `indeterminate` is a DOM property with no attribute, so it is set here. */
    markMixed(input: HTMLInputElement, group: MultiselectGroup): void {
      input.indeterminate = this.stateOf(group) === 'some'
    },

    toggle(): void {
      if (this.open) this.close()
      else this.open = true
    },
    /** Closes the checklist with an empty filter and returns focus to the disclosure button. */
    close(): void {
      if (opts.inline) return
      this.open = false
      this.query = ''
      document.getElementById(this.ids.button)?.focus()
    },
    /**
     * Esc: the first press clears the filter text (focus stays), the next closes. Inline, the next
     * press is not handled, so it reaches the enclosing dialog. With `e`, a handled press stops there.
     */
    escape(e?: KeyboardEvent): void {
      if (this.query) this.query = ''
      else if (!opts.inline) this.close()
      else return
      e?.preventDefault()
      e?.stopPropagation()
    },
    toggleValue(value: string): void {
      opts.onChange(toggleIn(opts.value(), value, optionValues(opts.groups())))
    },
    setGroup(group: MultiselectGroup, event: Event): void {
      const on = (event.target as HTMLInputElement).checked
      opts.onChange(setIn(opts.value(), group.options.map((o) => o.value), on, optionValues(opts.groups())))
    },
    /** Removes a chip and moves focus to the chip now in its place, else the disclosure button (inline: the filter). */
    remove(value: string, event: Event): void {
      const chips = [...this.$refs.chips.querySelectorAll<HTMLElement>('.ctl-chip')]
      const index = chips.indexOf(event.currentTarget as HTMLElement)
      this.toggleValue(value)
      void this.$nextTick(() => {
        const next = this.$refs.chips.querySelectorAll<HTMLElement>('.ctl-chip')
        const target = next[Math.min(index, next.length - 1)] ?? document.getElementById(opts.inline ? this.ids.filter : this.ids.button)
        target?.focus()
      })
    },
  })
}
