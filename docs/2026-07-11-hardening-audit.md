# Loan Ledger Hardening Audit

Date: 2026-07-11

Scope: current committed application at `5df8c28` plus read-only audit scripts outside the repository.

## Executive result

The selected stack is appropriate for a static financial calculator. The initial production payload is small, normal and maximum OD calculations are fast, cross-browser behavior is consistent, the application makes no runtime network requests, and 1,000 deterministic randomized scenarios preserved the tested financial invariants. A rewrite, Web Worker, service worker, state library, UI kit, or decimal dependency is not justified.

The application is not ready to be called fully hardened. Four correctness defects, one pathological recurring-prepayment algorithm, incomplete shared-state validation, eager schedule rendering, mobile touch-target issues, and CI privilege concentration require fixes. A literal guarantee of zero maintenance for 10–20 years is impossible on GitHub/npm/browser infrastructure; the achievable target is a reproducible, dependency-light static artifact that continues serving without active application infrastructure.

## Evidence baseline

| Check | Result |
|---|---:|
| Initial JS + CSS transfer in local production preview | 76,396 bytes |
| Runtime resource requests | 2, both same-origin static assets |
| Initial DOM nodes, default 240-month scenario | 3,034 |
| First contentful paint, local headless runs | 76–100 ms |
| Default calculation average | 0.42 ms |
| 480-month OD + 100 dated deposits average | 2.33 ms |
| 100 recurring prepayments | Did not finish within one minute |
| Unit tests | 24 passing |
| Deterministic randomized invariant scenarios | 1,000; no invariant failures |
| Production dependency audit | 0 known vulnerabilities |
| Initial application console/page errors | None |

Local preview timings are regression baselines, not real-user network benchmarks.

## Confirmed correctness findings

| ID | Priority | Finding | Evidence | Required outcome |
|---|---|---|---|---|
| COR-001 | High | A structurally malformed but valid-version shared fragment crashes the page. | A fragment with `rateChanges: [null]` produces `Cannot read properties of null (reading 'date')`; `src/lib/share.ts:decodeScenario` trusts nested array members. | Normalize only declared fields/types or reject the fragment and load defaults with a warning. |
| COR-002 | High | Money rounding is not reliably half-up. | `roundMoney(10.075)` returns `10.07`; `src/domain/loan/index.ts:roundMoney`. | Use a tested non-negative paise half-up implementation and retain fractional paise only inside daily accrual. |
| COR-003 | High | “Net debt-free date” can be false after a later withdrawal. | Full opening offset followed by withdrawal retains the opening date while later net utilization is positive. | Define the date as the first day after the final utilized day, considering all future scenario events. |
| COR-004 | Medium | Duplicate rate changes on the same EMI date silently overwrite in a `Map`. | `src/domain/loan/index.ts:buildStandardSchedule`. | Reject duplicate rate-change dates; reject exact duplicate IDs/dates where ambiguity affects semantics. |
| COR-005 | Medium | Same-date recurring contribution and arbitrary OD transactions are attributed to adjacent monthly rows. | Contributions are added after one row while that EMI-date transaction is processed at the start of the next period. | Keep calculation order explicit and make schedule/export attribution match the event date. |
| COR-006 | Medium | Print remains enabled for invalid current inputs and prints the last valid result. | Share/CSV/XLSX buttons are disabled on errors; print is not (`src/App.tsx`). | Disable print or visibly label the retained result as stale. |
| COR-007 | Low | Disabled OD transaction rows remain exportable in the workbook scenario sheet. | `src/lib/exports.ts` exports the stored list regardless of `transactionsEnabled`. | Export an enabled flag or only active transactions so the workbook is not misleading. |

## Confirmed performance findings

| ID | Priority | Finding | Cause | Required outcome |
|---|---|---|---|---|
| PERF-001 | High | Recurring prepayments can freeze the page. | For each month and prepayment, `prepaymentDue` scans up to 600 cycles and repeatedly constructs UTC dates: approximately 28.8 million conversions at the intended maximum. | Convert dates to verified cycle indices once and use arithmetic frequency checks. |
| PERF-002 | Medium | Each scenario edit calculates twice. | `setNextScenario` calculates for `lastValidResult`, then `useMemo` calculates the same scenario again. | Store the current calculation with the scenario and calculate once per state transition. |
| PERF-003 | Medium | Schedule rendering constructs thousands of formatters and DOM nodes. | `formatCurrency` creates an `Intl.NumberFormat` each call; every collapsed year’s monthly rows are mounted. | Cache formatters and mount monthly rows only for expanded years. |
| PERF-004 | Low | ExcelJS produces a 256 KB gzip lazy chunk and 88 transitive production packages. | Typed XLSX generation is a complex format and ExcelJS is lazy-loaded. | Retain it for correctness; keep it isolated from initial load and cover workbook generation with tests. A custom XLSX writer would increase risk. |
| PERF-005 | None | The daily OD loop is not a real bottleneck. | It is bounded to roughly 18,300 simple day iterations and a 480-month/100-transaction case averages 2.33 ms. | Keep the explicit daily ledger for auditability; do not replace it with a harder-to-verify segmented engine. |

## Browser and mobile matrix

The same complex scenario was exercised with homeowner cost, quarterly prepayment, keep-tenure rate reset, OD premium, opening/monthly surplus, dated transaction, CSV, XLSX, and print.

| Runtime | Console errors | Overflow | CSV/XLSX | EMI | OD savings |
|---|---:|---:|---:|---:|---:|
| Desktop Chromium | 0 | No | Pass | ₹38,651 | ₹6,28,729 |
| Desktop Firefox | 0 | No | Pass | ₹38,651 | ₹6,28,729 |
| Desktop WebKit | 0 | No | Pass | ₹38,651 | ₹6,28,729 |
| iPhone 13 WebKit emulation | 0 | No | Pass | ₹38,651 | ₹6,28,729 |
| Pixel 5 Chromium emulation | 0 | No | Pass | ₹38,651 | ₹6,28,729 |

Additional responsive inspection passed at 320×568, 375×812, 430×932, 768×1024, 812×375, and 1440×900. Physical-device, assistive-technology, slow-network and thermal/battery testing remain unavailable in this environment and must not be claimed as completed.

## Accessibility and mobile findings

| ID | Priority | Finding | Evidence | Required outcome |
|---|---|---|---|---|
| UX-001 | Medium | Unit toggles, Reset/Add controls, wordmark and visible switch control are below 44 px in one dimension. | Automated bounding-box scan across all six viewports. | Give interactive controls a minimum 44 px target without materially increasing visual weight. |
| UX-002 | Medium | Errors are not programmatically tied to responsible inputs. | Central message list only; fields lack `aria-invalid` and `aria-describedby`. | Return field-keyed validation and attach concise inline errors. |
| UX-003 | Low | Field hint text becomes part of accessible names and produces partial-name ambiguity. | “Home value” also partially matched the calculated-loan field in browser automation. | Use explicit label spans/`aria-describedby` so hints remain descriptions. |
| UX-004 | Medium | All collapsed schedule years still mount their monthly tables. | 3,034 initial DOM nodes for the 240-month default. | Render the table only when its native `<details>` year is expanded. |
| UX-005 | Low | Share provenance is easy to miss. | Malformed links warn, but valid received links are indistinguishable from local input. | Show a persistent, non-alarming “Loaded from a shared link—verify inputs” notice. |

## Security findings

The full repository-grounded analysis is in `loan_emi_calculator-threat-model.md`.

- No raw HTML insertion, eval/dynamic code, SSRF-capable request, remote runtime script, application secret, account boundary, database, or backend exists.
- URL fragments are the only remote attacker-controlled runtime entry point.
- Shared links intentionally disclose all encoded inputs to anyone who receives the URL.
- Build/deploy dependency execution is the primary privileged boundary.
- Build and deploy should be separate jobs so npm code runs without Pages write or OIDC permissions.
- Action references should be immutable commits with automated update support, or the mutable-tag risk must remain explicitly accepted.
- A meta CSP would not provide `frame-ancestors` protection and could complicate Vite development; with no runtime injection sink or remote content, it is not currently the highest-value control.

## Test coverage gaps

The existing suite covers core formulas, Actual/365, leap dates, OD equality, deposits/withdrawals, rate modes, fees, limits, reconciliation, sharing, typed XLSX and one broad browser flow. Missing regression evidence includes:

- Deep malformed shared-state types and prototype-shaped/unexpected keys.
- Half-up rounding boundary table.
- Duplicate rate/prepayment dates and list limits.
- Permanent net-debt-free date after future withdrawals.
- Exact same-day rate/payment/prepayment/contribution/arbitrary-transaction attribution.
- All four prepayment frequencies across month-end dates.
- Zero-rate, one-month, maximum-rate, maximum-tenure and early-payoff boundary matrix.
- Percentage/amount bases for every dual-mode input.
- Disabled optional data being ignored in UI and exports.
- Invalid-current-input behavior for print and all exports.
- Shared-link provenance and round-trip in a new browser context.
- Maximum supported scenario performance budget.
- Lazy schedule DOM budget and expand/collapse behavior.
- Touch targets and no-overflow assertions for mobile Chrome and WebKit.
- CI workflow permission and Pages-subpath checks after job separation.

## Maintenance assessment

- Keep Vite + React + TypeScript. Rewriting the working UI in vanilla JavaScript would trade a small bundle reduction for much greater regression and maintenance risk.
- Keep the pure financial engine outside React and preserve native controls/SVG/CSS.
- Keep ExcelJS lazy. Its latest stable release is older and has a large transitive graph, but replacing a standards-compliant XLSX writer with custom ZIP/XML code is the less maintainable choice.
- Pin the Node/npm build toolchain and exact direct dependencies; retain `package-lock.json` and a clean `npm ci` path.
- Keep the deployed product fully static with no service worker, backend, analytics, remote fonts, or runtime API dependency.
- Add a reproducible release verification command and archive a verified build artifact with each release if long-term rebuild independence becomes a requirement.
- Re-run this audit whenever a backend, authentication, telemetry, third-party runtime script, lender-specific guarantee, or regulated use is introduced.
