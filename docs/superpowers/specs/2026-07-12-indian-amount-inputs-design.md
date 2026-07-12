# Indian Amount Input Design

**Date:** 2026-07-12
**Status:** Approved for implementation

## Objective

Make every amount field easy to replace and verify. Remove the persistent-zero editing problem, display monetary values with Indian digit grouping, and show a compact rupee amount in words below every direct or percentage-based amount input.

## Scope

The behavior applies across Generic, Home, Car, Personal, and Education calculators, optional event rows, OD controls, and all solver tools.

- Direct monetary fields use Indian grouping and an amount-in-words helper.
- Fields that represent an amount but can be entered as a percentage show the calculated rupee equivalent and its words while in percentage mode.
- Pure rate percentages, GST rates, tenure/month counts, dates, and other non-amount values remain ordinary numeric/date fields and do not show amount words.
- Existing result, graph, schedule, CSV, XLSX, share, and calculation values remain numeric and unchanged.

## Editing behavior

Use a shared controlled display layer around the existing numeric domain value.

1. When an amount field is not focused, display Indian digit grouping, for example `1,23,45,678.50`.
2. On focus, show the ungrouped numeric text so cursor movement and selection remain predictable.
3. The user may clear the complete field. The UI keeps an empty local draft instead of immediately restoring or prefixing `0`.
4. While the draft is empty, do not send a replacement numeric value to the calculation model.
5. Accept digits and one decimal separator; accept pasted Indian or international comma grouping by removing commas before validation.
6. On blur, commit a valid numeric draft. Resolve an empty draft to `0`, then display the grouped value.
7. Preserve existing `min`, `max`, `step`, field-error, and calculation validation semantics. An incomplete or invalid draft may remain visible while focused; blurring restores the last valid domain value instead of committing `NaN` or malformed text.

This focus/raw and blur/formatted model is preferred over formatting each keystroke because it avoids caret jumps during middle edits.

## Indian formatting

Provide pure shared helpers for:

- Indian digit grouping (`1,000`, `10,000`, `1,00,000`, `1,00,00,000`);
- safe parsing of ungrouped or comma-grouped input;
- Indian English amount words using thousand, lakh, and crore units.

The supported financial range must cover all calculator validation limits. Words are based on the resolved rupee equivalent rounded to the nearest rupee for readability. The numeric domain value retains its existing precision.

Examples:

- `0` → `₹0 · Zero rupees`
- `1,000` → `₹1,000 · One thousand rupees`
- `1,00,000` → `₹1,00,000 · One lakh rupees`
- `1,00,00,000` → `₹1,00,00,000 · One crore rupees`
- `1,23,45,678` → `₹1,23,45,678 · One crore twenty-three lakh forty-five thousand six hundred seventy-eight rupees`

## Percentage-based amount equivalents

An amount field in percentage mode keeps its percentage as the editable value but shows its resolved rupee amount below the control:

`Equivalent: ₹10,00,000 · Ten lakh rupees`

Each calculator supplies the same base already used by its financial calculation:

- Home down payment and home-based costs: home value.
- Home OD opening parked percentage: calculated loan/drawing-power base.
- Car down payment: vehicle-price base defined by the Car calculator.
- Personal processing-fee percentage: requested principal.
- Any future amount/percentage field must explicitly supply its rupee equivalent; the shared field must not guess a base.

If the base or percentage is not finite or currently invalid, hide the equivalent rather than display a misleading amount.

## Presentation and accessibility

- Place the helper immediately below its input shell in small, readable, high-contrast text.
- Keep it visually subordinate to hints and errors; errors retain priority.
- Include the helper ID in `aria-describedby` so screen-reader users receive the formatted equivalent and words.
- Do not put words inside the input value or accessible name.
- Preserve existing labels, prefixes/suffixes, touch targets, focus treatment, and mobile layouts.

## Components and boundaries

- Add pure formatting/parsing/words helpers in `src/lib` with focused unit tests.
- Extend the shared `NumberField` contract with an explicit amount-display mode and optional resolved rupee equivalent.
- Keep calculator-specific percentage bases in their existing form adapters rather than in the shared component.
- Avoid a masking library, form library, locale dependency, or changes to domain scenario types.

## Verification

- Unit-test clearing a zero value, replacing the whole value, paste with commas, decimal entry, focus/raw display, and blur/grouped display.
- Unit-test zero, thousand, lakh, crore, maximum supported values, rounding, and non-finite handling.
- Unit-test direct amount and percentage-equivalent helpers.
- Add browser coverage for the reported leading-zero journeys in a main calculator and solver.
- Cover monetary amount helpers and percentage equivalents across calculator types.
- Re-run the complete unit suite, browser matrix, responsive overflow checks, and production build.

## Non-goals

- Changing loan formulas, validation ranges, rounding/posting rules, exports, or share codecs.
- Spelling rate percentages or month counts in words.
- Live comma insertion during each keystroke.
- Supporting locale switching in this change.
