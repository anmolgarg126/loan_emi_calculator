# Loan Ledger Hardening Design

**Status:** Approved approach; written specification pending final user review

**Date:** 2026-07-11

**Inputs:** `docs/2026-07-11-hardening-audit.md`, `loan_emi_calculator-threat-model.md`, and the existing calculator design.

## Objective

Harden the existing static Loan Ledger application for financial accuracy, bounded performance, responsive browser behavior, security, and low maintenance without rewriting the working stack or adding runtime infrastructure. Preserve all current product features and lender-neutral semantics.

The implementation will use the smallest reliable changes: keep Vite, React, TypeScript, native CSS/SVG/browser controls, the pure loan domain, GitHub Pages, and lazy ExcelJS. Do not add a backend, Web Worker, service worker, state library, schema library, decimal library, UI kit, runtime analytics, remote font, or remote script.

## Architecture

The existing boundaries remain:

- `src/domain/loan`: validation, EMI-cycle indexing, standard amortization, daily OD ledger, aggregation, and formatting.
- `src/lib/share.ts`: strict versioned fragment decoding and encoding.
- `src/lib/exports.ts`: local CSV and lazy typed XLSX generation.
- `src/components`: native charts and lazily expanded schedule presentation.
- `src/App.tsx`: controlled inputs and one calculated state transition per scenario edit.
- `.github/workflows/deploy.yml`: unprivileged verification/build job followed by a minimal privileged deployment job.

No financial formula moves into React. No new runtime dependency is introduced.

## Financial correctness

### Money and rounding

- Inputs and posted money remain decimal rupees exposed to the UI.
- Daily OD accrual retains fractional paise in a JavaScript number until monthly posting.
- `roundMoney` implements symmetric half-away-from-zero rounding to paise using a scale-aware floating-point tolerance. It must produce `10.08` for `10.075`, `-10.08` for `-10.075`, and preserve the existing golden schedules.
- Intermediate contractual balances, payments, fees, deposits, and withdrawals continue to post at paise precision at their specified event boundaries.
- Replacing all arithmetic with an arbitrary-precision dependency is out of scope because supported magnitudes remain safely within JavaScript integer precision at the paise level and the only sub-paise state is bounded monthly interest accrual.

### EMI-cycle indexing

- Add one function that converts a valid date to its EMI-cycle index relative to the start date.
- Compute the calendar month delta directly, then verify it by comparing with `addMonths(startDate, index)`. A non-cycle date returns `null`.
- Validation, rate changes, and prepayments reuse this function.
- Normalize each prepayment once to its starting cycle and frequency interval: once `0`, monthly `1`, quarterly `3`, yearly `12`.
- A prepayment is due when the payment cycle is not earlier than its start and either the frequency is once at the same cycle or the cycle difference is divisible by the interval.
- This replaces all repeated 600-cycle scans. The daily OD loop remains explicit because its supported maximum is small and measured below 3 ms.

### Validation and deterministic events

- Rate changes, prepayments, and arbitrary OD transactions are each capped at 100 entries in both UI and domain validation.
- Rate-change dates must be unique because two active rates cannot apply on one date.
- Exact duplicate IDs are rejected within each list; valid shared scenarios retain IDs for stable round trips.
- Money/rate validation rejects non-finite values and wrong runtime types, not only out-of-range numbers.
- Mode, frequency, reset-mode, and transaction-type values must belong to their declared enums.
- Invalid basic scenarios stop before schedule generation; the UI continues displaying the last valid result with current-input errors.
- Optional disabled collections remain ignored by calculation. Exports explicitly identify whether stored OD transactions were enabled.

### OD event ledger and schedule attribution

The existing event order remains authoritative for every calendar date:

1. Activate a rate change at the start of the date.
2. On an EMI date, post interest accrued through the previous date.
3. Apply the scheduled transfer and contractual principal reduction.
4. Apply permanent prepayments.
5. Apply the recurring OD contribution while drawing power remains above zero.
6. Apply arbitrary deposits, then arbitrary withdrawals.
7. Reject withdrawals exceeding opening available withdrawal plus same-day deposits.
8. Accrue current-date interest on the closing net utilized balance.

A monthly OD row is dated by its EMI date. It contains interest posted on that date plus scheduled payment, prepayment, recurring contribution, and arbitrary transactions through and including that date. Interest accrued on the EMI date posts in the following row. This makes UI, CSV, and XLSX attribution consistent with event dates.

### Permanent net debt-free date

“Net debt-free date” means the first calendar date after the final day on which net utilized balance was positive, given every future event in the scenario.

- Track the last positive-utilization day through the complete daily ledger.
- If utilization never becomes positive, the date is the loan start date.
- If the final state is positive, the value is `null`.
- Otherwise it is the day after the last positive-utilization day.
- A temporary full offset followed by a withdrawal cannot be reported as debt-free.

## Shared-state boundary

`decodeScenario` remains a dependency-free parser but becomes structurally strict:

- Enforce the existing version and 8,000-character limit before decoding.
- Require the decoded root and nested OD value to be plain records.
- Read only declared keys; unknown keys are ignored.
- For every present scalar, require the expected primitive type and a finite number where applicable. Missing values use current defaults for forward-compatible partial v1 links.
- Validate every list member as a plain record with the required string ID/date and declared enum/numeric fields.
- Enforce 100-entry list limits and unique IDs during parsing.
- Any structural failure rejects the complete fragment, loads defaults, and shows a recoverable warning. Partially applying an untrusted fragment is forbidden.
- A valid received fragment displays a persistent notice: “Loaded from a shared link—verify every input. Anyone with this URL can read its financial values.”
- React continues rendering all decoded strings as text; no raw HTML path is added.

## Rendering and interaction performance

- Application state stores `scenario`, `currentResult`, and `lastValidResult`. Each input transition invokes `calculateLoan` exactly once.
- Cache `Intl.NumberFormat` instances by supported fraction-digit count instead of constructing one per cell.
- The schedule groups yearly summaries eagerly but mounts monthly table rows only while that native `<details>` year is expanded. The first year remains expanded by default.
- Charts keep the existing maximum sampling and native SVG implementation.
- ExcelJS stays in the existing lazy chunk and loads only after the Excel action.
- Blob URLs are revoked with `setTimeout(..., 0)` after download dispatch so WebKit/Safari downloads remain reliable.

Performance acceptance gates on the project’s reference environment:

- Default calculation median below 2 ms.
- Supported maximum OD calculation median below 20 ms.
- Supported 100-recurring-prepayment calculation median below 20 ms and never above a 100 ms CI guard.
- Default initial DOM below 1,000 elements.
- Initial production JS + CSS gzip transfer remains below 85 KB; the lazy Excel chunk is excluded.
- No runtime request targets a non-same-origin application resource.

## Responsive UI and accessibility

- Preserve the existing visual design and information hierarchy.
- All visible interactive controls receive at least a 44×44 CSS-pixel target or an equivalent surrounding label target.
- Use explicit label text and `aria-describedby` hint/error elements so help text does not become the input name.
- Domain errors gain stable field keys. Responsible controls expose `aria-invalid=true` and reference concise inline messages. Cross-field/global errors remain in the live summary.
- Disable share, print, CSV, and XLSX actions while current inputs are invalid.
- Keep native date/number/select/details controls, visible focus, reduced-motion support, and horizontal table scrolling.
- Preserve no page-level horizontal overflow at widths from 320 px upward and in mobile landscape.
- Valid shared-link provenance remains visible until Reset or a new local scenario replaces it.

## Exports

- CSV and XLSX continue using the same calculation result as the UI.
- CSV remains machine-readable with ISO dates and decimal numeric values.
- XLSX retains native number, percentage, integer, Boolean, date, text, and formula cells.
- The OD Transactions worksheet adds an enabled Boolean/basis note so disabled stored rows cannot be mistaken for applied flows.
- All sheet totals must reconcile after reopening the serialized workbook.
- Print is unavailable for invalid current inputs and print CSS remains browser-native.

## Security and deployment

- Split GitHub Actions into `build` and `deploy` jobs.
- The build job has only `contents: read`; it installs, lints, type-checks, tests, builds, runs browser tests, and uploads the Pages artifact.
- The deploy job depends on build and alone receives `pages: write` and `id-token: write`.
- Pin GitHub Actions to immutable commit SHAs with readable version comments. Add monthly Dependabot checks for npm and GitHub Actions so updates are proposed rather than silently adopted.
- Keep exact direct package versions and `package-lock.json`; add a supported Node/npm toolchain declaration and use the same Node major locally and in CI.
- Verify whether `npm ci --ignore-scripts` supports the locked graph. Use it only if a clean install and the entire suite pass; otherwise retain `npm ci` and document why.
- Do not add a meta CSP merely for checklist compliance: there is no runtime remote content or injection sink, `frame-ancestors` is ineffective in a meta tag, and GitHub Pages cannot set custom response headers. Reconsider CSP/header-capable hosting if privileged runtime actions or third-party content are added.

## Long-term maintenance contract

“Maintenance free for 10–20 years” is treated as a durability target, not a guarantee that third-party platforms never change.

- The deployed application remains static and has no application server, database, scheduled job, secret, telemetry, external API, runtime package registry, or remote asset dependency.
- A successful deployed artifact continues working without rebuilding while GitHub Pages and standard browser APIs remain available.
- Builds are reproducible from exact direct versions, lockfile, declared Node/npm toolchain, and documented commands.
- Dependabot may propose maintenance updates, but no automated dependency update is merged without the full verification workflow.
- The release procedure records the verified source commit and production endpoint. Archiving the built artifact in a GitHub release is recommended when the repository is first published, without committing `dist` to source.
- Physical-device and future-browser behavior cannot be guaranteed today; the automated Chromium, Firefox, desktop WebKit, mobile Chrome, and mobile WebKit matrix is the maintained compatibility evidence.

## Test design

### Domain tests

- Golden EMI and independent Decimal/spreadsheet fixtures.
- Positive and negative half-paise boundaries.
- Zero rate, maximum rate, one month, maximum tenure, month-end and leap dates.
- Every prepayment frequency and direct cycle-index boundary.
- Duplicate dates/IDs, invalid enums/types, non-finite values, and all list limits.
- Both rate-reset modes, infeasible EMI, multiple sequential resets, and early payoff.
- Actual/365 across ordinary/leap years and exact event-order fixtures.
- Temporary full offset followed by withdrawal and permanent debt-free transition.
- Disabled-option equality and ownership-cost/savings separation.
- Deterministic 1,000-scenario invariant fuzzing without a new property-test dependency.
- A maximum-scenario benchmark/regression guard proving recurrence lookup is bounded.

### Sharing and export tests

- Valid full and partial v1 fragments, malformed base64/JSON/root/nested/list-member types, excess size/count, duplicate IDs, and unknown keys.
- Share round-trip and provenance in a new browser context.
- CSV row/value reconciliation.
- Reopened XLSX sheet names, native types, formats, enabled transaction metadata, formulas, and totals.

### Browser/mobile tests

- Separate focused flows for core inputs, cost modes, all prepayment frequencies, both rate modes, OD disabled/enabled, amount/percentage opening surplus, monthly contribution, arbitrary deposits/withdrawals, limits/removal, errors/reset, sharing, print, CSV, and XLSX.
- Chromium desktop, Firefox desktop, WebKit desktop, Pixel Chrome emulation, and iPhone WebKit emulation.
- 320, 375, 430, 768, 812 landscape, and desktop overflow checks.
- Touch-target size, accessible-name/description, invalid-state/action-disable, lazy schedule DOM, same-origin resource, console/page-error, and Pages-subpath assertions.
- Browser downloads must contain non-empty expected file types, not only emit a download event.

Physical device, screen-reader, real slow-network, battery, and thermal testing are explicit manual residual checks because this environment cannot provide authoritative evidence for them.

## Documentation deliverables

- Update the existing product design when event wording changes.
- Update `AI_CONTEXT.md` with the cycle-index, strict share boundary, permanent debt-free definition, performance budgets, CI separation, and durability contract.
- Keep `docs/2026-07-11-hardening-audit.md` as baseline evidence.
- Keep `loan_emi_calculator-threat-model.md` and update mitigations/status after fixes.
- Add one verification command to README/package scripts that runs all non-browser gates; retain explicit browser commands separately where browser installation is required.

## Acceptance criteria

- Every confirmed COR, PERF, UX, and medium-priority threat finding in the hardening audit is fixed, explicitly accepted with rationale, or proven non-reproducible.
- Golden, boundary, event-order, deterministic fuzz, sharing, export, and performance tests pass.
- The complex scenario produces identical EMI and savings across supported browser engines.
- No page crash occurs for any fragment at or below the accepted length; malformed fragments recover to defaults with a warning.
- Current invalid inputs cannot share, print, or export retained results.
- UI, schedule, charts, CSV, and reopened XLSX reconcile to one result model.
- Initial payload, maximum calculation, DOM, responsive overflow, touch-target, dependency audit, and CI-permission gates pass.
- The production build and smoke suite pass under `/loan_emi_calculator/`.
- The final report distinguishes verified automated evidence from physical-device/future-platform limitations.
