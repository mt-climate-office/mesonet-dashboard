# ui/controls

Small, accessible form controls shared by the tabs. Each one is an `Alpine.data` factory plus a
markup snippet. The full snippet is in the factory's file header, and `demo.html` uses every one.
`controls.css` styles them using kit tokens only. Fields, selects, date fields and segmented buttons share
one height, `--ctl-h` (34 px, 40 px on touch), so controls side by side line up; a context may raise it
(the photo dialog: 44 px on touch; the Download sheet's rows: 40 px). Selects and date fields drop the
native look (WebKit ignores a select's height and draws no date-picker cue) and draw a CSS chevron or
calendar icon instead.

How the controls work:

- **State.** A control reads its state through getters (`value: () => …`) and reports changes
  through a callback (`onChange` / `onSelect`). The caller owns the state, usually a store, so the
  URL stays the source of truth.
- **Registration.** Register the factories in `main.ts`, e.g. `Alpine.data('multiselect', multiselect)`.
- **Logic.** Pure logic lives in `src/core/controls/*Model.ts` (with unit tests), per the layer rule. The `.ts` factories here only hold
  view state and ARIA wiring.
- **Review.** To check by hand, open `demo.html` through the Vite dev server with
  `?theme=dark|light|high-contrast`.

## Station search: the kit's

The station search (picker and landing) is the kit's `MCO.places.initPlaceSearch` on
`MCO.initSearchBox` (mco-web-style 0.16.0), wired in `ui/picker/stationSearch.ts`; this directory no longer
has a combobox. Its markup is `partials/picker/search.html`; its rows are the kit's `.mco-search-*`,
styled for the dashboard in `controls.css` (§ Search list).

## multiselect: grouped checkboxes (Downloader elements)

Use it to pick many items from a few named groups.

**API**

```ts
multiselect({ groups: () => Group[], value: () => string[], onChange(string[]), label, inline? })
Group = { id, label, options: { value, label }[] }
```

**Behavior**

- A disclosure button shows the label and the selected count, and opens a panel.
- The panel has a filter box and one fieldset per group, each with a "Select all" checkbox. That
  checkbox shows a mixed state and applies to the group's visible options.
- Escape clears the filter text first; the next Escape closes the panel (clearing the filter) and returns focus to the button.
- The selection shows as removable chips. Removing one moves focus to the next chip.
- Output is always in option order, not click order.
- `inline: true` shows the checklist always, with no disclosure button, where the place around it is
  already a disclosure (the Download sheet's Variables row). Escape then clears the filter, and the next
  Escape goes on to the enclosing dialog.

```html
<div class="ctl-multiselect" x-data="multiselect({ groups: () => …, value: () => …, onChange: (v) => …, label: 'Elements' })">
  …see multiselect.ts…
</div>
```

## dateRange, dateInput, timeSelect: dates and photo time

**dateRange** is a start and end pair for a bounded period, such as a station's period of record.

```ts
dateRange({ value: () => {start, end}, onChange({start, end}), min?: () => string | null, max?: () => string | null, label,
           onValidity?(valid), showError?: boolean | (() => boolean) })
```

- It uses two native `<input type="date">`.
- It shows one inline error, with `aria-invalid` and `aria-describedby`, when a date is empty,
  out of bounds, or start > end.
- It emits `YYYY-MM-DD` strings only, and only when the range is valid. `onValidity(valid)` fires on init
  and whenever the draft's validity flips (e.g. to disable a submit button).
- `showError` (default true) hides the inline message when false (or a getter returning false), so a
  caller can show its own text instead; `aria-invalid` stays.
- It never clamps while the user is typing. Callers that need to fit an existing range into a new
  period (for example, after a station change) use `clampRange` from `core/controls/dateModel.ts`.

**dateInput** is the same for one date: `dateInput({ value, onChange, min?, max?, label })`.

**timeSelect** is a native `<select>`: `timeSelect({ options: () => {value, label}[], value, onChange,
label, emptyText? })`. It is disabled with a placeholder row while `options` is empty.

All date parsing is by hand in `core/controls/dateModel.ts`; the code never calls `new Date(string)`.

```html
<fieldset class="ctl-fieldset" x-data="dateRange({ value: () => …, onChange: (r) => …, min: () => …, max: () => …, label: 'Dates' })">
  …see dateRange.ts…
</fieldset>
```

## segmented: one-of-few choice

Use it for 2–5 mutually exclusive options, such as units or a period.

```ts
segmented({ options: () => {value, label, disabled?}[], value: () => string, onChange(value), label })
```

It is a native radio `<fieldset>` styled as the kit's `.seg-btns > .seg-btn`:

- The pressed look comes from `:checked`.
- The radio covers its segment, so the kit's focus ring outlines the segment.
- Arrow keys, Tab and disabled options behave natively.
- To hide the legend visually, add `.sr-only` to it.

```html
<fieldset class="ctl-seg" x-data="segmented({ options: () => …, value: () => …, onChange: (v) => …, label: 'Units' })">
  …see segmented.ts…
</fieldset>
```

## chips: multi-toggle

Use it for a few independent on/off filters, such as networks.

```ts
chips({ options: () => {value, label}[], value: () => string[], onChange(string[]), label })
```

- The chips are compact kit `.nav-btn` toggle buttons in a labelled `role="group"`.
- `aria-pressed` is both the state and the styling hook. Pressed chips also show a ✓, so state does
  not rely on color.
- Output is in option order.

```html
<div class="ctl-chips" role="group" :aria-labelledby="ids.label" x-data="chips({ options: () => …, value: () => …, onChange: (v) => …, label: 'Networks' })">
  …see chips.ts…
</div>
```

## rangeSlider: low/high thresholds (GDD)

Use it for a numeric pair with an optional "no upper limit" setting.

```ts
rangeSlider({ min, max, step, allowNone, unit, value: () => {low, high | null}, onChange(v), label, lowLabel?, highLabel? })
```

- One track with two thumbs: two native `<input type="range">` laid over each other (only the thumbs take
  the pointer; the stretch between them is filled). Each keeps its own label, keys and value text.
- Past the middle of the track the low thumb sits on top, so touching thumbs can always be pulled apart.
- Low stays at least one step below high.
- With `allowNone`, the high slider has an extra stop at `max + step` that emits `high: null` and
  reads as "No upper limit".
- `aria-valuetext` carries the unit.
- It emits on `change` (release or key press), not on every drag frame.

```html
<fieldset class="ctl-fieldset ctl-range" x-data="rangeSlider({ min: 32, max: 100, step: 1, allowNone: true, unit: '°F',
          value: () => …, onChange: (v) => …, label: 'GDD thresholds' })">
  …see rangeSlider.ts…
</fieldset>
```
