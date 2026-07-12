# Frontend Audit and Targeted Product Polish Design

**Date:** 2026-07-12
**Status:** Approved, uncommitted

## Design read

This is a redesign-preserve audit of a privacy-first financial product for Indian borrowers. The interface remains calm, lender-neutral, information-dense, and accessibility-led. The working design dials are variance 4, motion 2, and density 6.

The current React and plain-CSS foundation remains authoritative. The marketing-oriented parts of the design-taste guidance apply only to the header and introductory shell; financial forms, result summaries, graphs, and schedules retain product-UI conventions.

## Objective

Repair verified visual and React-performance gaps, add a lightweight remembered dark theme, improve result scanning, and preserve all calculator behavior. Do not change formulas, scenarios, schedules, exports, sharing, URLs, storage semantics for financial data, or GitHub Pages deployment.

## Verified audit findings

- The cost overview references undefined `--teal` and `--line-strong` CSS variables, causing browser fallback colors.
- The result panel repeats loan amount and interest after already presenting them in the cost overview.
- Visible text contains inconsistent em-dash, en-dash, minus, and middle-dot separators.
- The application has no theme preference layer.
- `buildCostBreakdown(displayed)` reduces full schedules again during unrelated App renders.
- The result action area presents sharing, local persistence, printing, and downloads as one undifferentiated button group.
- Several interface, graph, validation, and overlay colors are hard-coded instead of using semantic tokens, preventing a complete dark theme.

## Scope

### Preserve

- Calculator tabs, quick solvers, guided section order, field names, field order, and labels.
- Generic, Home, Car, Personal, Education, and Home OD formulas and validation.
- Share URL and remembered-scenario schemas.
- Independent in-memory calculator tabs and client-only calculations.
- CSV, typed XLSX, print, graph, and schedule semantics.
- Current teal identity and current light appearance as the default.
- Keyboard navigation, focus visibility, reduced motion, and 320 px horizontal fit.

### Change

- Add a remembered light/dark theme preference.
- Repair and complete semantic design tokens.
- Improve cost-summary hierarchy and remove duplicated legacy metric rows.
- Separate action groups by intent.
- Make section summary categories easier to scan without long separator strings.
- Memoize the derived cost breakdown.
- Correct visible punctuation and separator inconsistencies.

## Theme behavior

- Light is the default for a new browser profile.
- An icon-only button in the header toggles themes.
- Use native text-presentation Sun and Moon symbols to avoid an icon-library bundle cost.
- The icon represents the available action. The accessible label is `Switch to dark mode` or `Switch to light mode`.
- The control is at least 44 by 44 CSS pixels, has a visible focus state, exposes `aria-pressed`, and has a native tooltip through `title`.
- Store only `light` or `dark` under a versioned theme key. Wrap reads and writes in `try/catch`; invalid or unavailable storage falls back to light.
- Apply the saved theme before React mounts to avoid a theme flash.
- Theme preference is presentation-only and never enters share URLs, calculator state, exports, or remembered financial scenarios.
- Print media always uses the light palette.

## Visual system

Use semantic CSS variables for page background, panels, muted surfaces, primary and secondary text, dividers, accent, focus, danger, warning, disabled states, overlays, graph gridlines, axes, tooltips, and input borders.

The existing radius rule remains: small controls use 6 px, grouped surfaces use 10-12 px, and only badges, segmented states, and switches use pill or circular geometry. No glow, glass, web font, decorative image, or animation library is added.

Dark mode remains the same teal product family on dark blue-green surfaces. It must preserve WCAG AA contrast for body text, inputs, helpers, buttons, status messages, and graph labels. The page remains one consistent theme from header through schedule.

## Result hierarchy

- Retain the calculator-specific EMI headline.
- Present total ongoing monthly cost and gross selected-tenure cost as the strongest cost-summary values.
- Retain loan composition, interest, other charges, total loan payable, upfront contribution, proceeds, net cost, and OD comparison where applicable.
- Remove only legacy metric rows already represented in the overview. Keep calculator-specific unique metrics such as payoff date, rates, settlement, and phase dates.
- Keep section reconciliation but present monthly cost, one-time cost, total cost, planned cash flow, and proceeds as distinct wrapped items.
- Keep every current action, grouped into share/local actions and print/download actions.

## React and bundle behavior

- Memoize `buildCostBreakdown(displayed)` using `useMemo` so status updates, theme changes, and solver visibility do not rescan schedules.
- Do not add speculative `memo`, `useCallback`, or context layers without evidence that they avoid meaningful work.
- Preserve conditional dynamic imports for ExcelJS, solver UI, graph, and schedule analysis.
- Add no icon library, theme framework, component framework, animation dependency, or web font.
- Retain the existing bounded initial DOM and closed-year schedule rendering.

## Lightweight budgets

- Initial JavaScript plus CSS must remain at or below 85 kB gzip.
- The complete theme feature may add no more than approximately 2 kB gzip to the initial path.
- ExcelJS stays in its lazy chunk and loads only for Excel export.
- No decorative media, background filters, perpetual effects, or runtime network resources are introduced.
- If the icon package or implementation exceeds the budget, simplify or replace the approach before completion rather than raising the budget.

## Copy and accessibility

- Replace visible em-dashes and en-dashes with clear sentences, commas, parentheses, hyphens, or `Not applicable` as appropriate.
- Use the mathematical minus sign only for actual subtraction or deducted amounts.
- Avoid multiple middle-dot separators in a single line; use separately wrapped labels for cost categories.
- Preserve semantic headings, definition lists, table headers, live regions, keyboard tab behavior, touch targets, and error associations.
- Do not rely on color alone for cost, proceeds, selected state, validation, or graph series.

## Failure handling

- Storage read or write failure leaves the app usable and keeps the current in-memory theme.
- Invalid stored theme values resolve to light.
- Existing invalid-calculation stale-result behavior remains unchanged.
- Theme switching cannot interrupt editing, exports, remembered scenarios, or graph selection.

## Verification

- Unit-test theme parsing, storage failure, invalid values, and persistence helpers.
- Browser-test default light mode, icon accessible names, theme switching, refresh persistence, and isolation from scenario/share data.
- Assert duplicated result rows are absent while unique calculator metrics remain.
- Verify print uses light tokens.
- Inspect light and dark modes at 1440x900, 1024x768, 430x932, 375x812, 320x568, and 812x375.
- Run lint, type-checking, unit tests, production build, the five-project Playwright matrix, GitHub Pages subpath build and matrix, dependency audit, and `git diff --check`.
- Record initial gzip sizes and confirm the 85 kB and 2 kB growth budgets.

## Non-goals

- Formula, schedule, validation, export, or share-schema changes.
- Navigation, URL, or information-architecture changes.
- A component-framework migration.
- Automatic system-theme selection. Light remains the default until the user toggles it.
- New charts, images, animation systems, accounts, analytics, or backend services.
- Creating, staging, or committing Git changes.
