# Loan Ledger Hardening Audit

Date: 2026-07-11

Baseline scope: committed application at `5df8c28` plus read-only audit scripts outside the repository. Resolution evidence below covers hardening commits through `a231459`.

## Executive result

The selected stack is appropriate for a static financial calculator. The initial production payload is small, normal and maximum OD calculations are fast, cross-browser behavior is consistent, the application makes no runtime network requests, and 1,000 deterministic randomized scenarios preserved the tested financial invariants. A rewrite, Web Worker, service worker, state library, UI kit, or decimal dependency is not justified.

The hardening work resolved every confirmed correctness, performance, accessibility, and medium-priority threat finding listed below. Regression tests now cover the corrected semantics, browser behavior, list limits, and Pages-subpath deployment. Physical-device, screen-reader, slow-network, and thermal/battery testing remain outside the automated evidence. GitHub/npm/browser changes still require routine maintenance; the static architecture removes application-server operations but does not guarantee permanent compatibility.

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

| ID | Priority | Finding | Resolution | Commit and regression evidence |
|---|---|---|---|---|
| COR-001 | High | A structurally malformed but valid-version shared fragment crashes the page. | **Resolved.** The decoder parses declared fields as one unit, rejects invalid nested values, discards unknown keys, and falls back with a warning. | `e73b736`, `8eec604`; `src/lib/share.test.ts` malformed, declared-field, and nested-key cases; `e2e/sharing-errors.spec.ts`. |
| COR-002 | High | Money rounding is not reliably half-up. | **Resolved.** Money posting uses symmetric round-half-away-from-zero to paise, including negative values; daily accrual retains fractional paise until posting. | `5257de2`; `src/domain/loan/loan.test.ts` “rounds fractional paise symmetrically” and Actual/365 posting cases. |
| COR-003 | High | A temporary full offset was reported as the net debt-free date before a later withdrawal. | **Resolved.** The result reports the day after the final positive-utilization day only when the horizon ends debt-free. | `0edf5a1`; `src/domain/loan/loan.test.ts` “reports only a permanent net debt-free date”. |
| COR-004 | Medium | Duplicate rate changes on the same EMI date silently overwrite in a `Map`. | **Resolved.** Validation rejects duplicate IDs, duplicate rate-change dates, blank IDs, malformed members, and over-limit lists before schedule generation. | `938e53f`, `90ec54f`; duplicate/list and malformed-member cases in `src/domain/loan/loan.test.ts`. |
| COR-005 | Medium | Same-date recurring contribution and arbitrary OD transactions were attributed to adjacent monthly rows. | **Resolved.** The engine processes the whole date in defined order and commits its flows to that EMI-date row. | `0edf5a1`, `fe65ec8`; same-day ordering, EMI-date attribution, and invalid-withdrawal atomicity cases in `src/domain/loan/loan.test.ts`. |
| COR-006 | Medium | Print remained enabled for invalid current inputs and printed the last valid result. | **Resolved.** Current validation state disables print, sharing, CSV, and XLSX while the UI labels the retained result. | `a9218f7`, `3857f1f`; `e2e/sharing-errors.spec.ts` invalid-input action checks. |
| COR-007 | Low | Disabled OD transaction rows remained exportable in the workbook scenario sheet. | **Resolved.** The workbook omits inactive transaction rows and exposes the transaction-enabled state. | `856b35a`; `src/lib/exports.test.ts` disabled optional-data case. |

## Confirmed performance findings

| ID | Priority | Finding | Resolution | Commit and regression evidence |
|---|---|---|---|---|
| PERF-001 | High | Recurring prepayments could freeze the page. | **Resolved.** Dates are converted to direct cycle indexes once; recurrence uses integer interval arithmetic. | `5257de2`, `99f5033`, `296bd91`; frequency, anchored recurrence, direct-index, and supported-maximum timing cases in `src/domain/loan/loan.test.ts`. |
| PERF-002 | Medium | Each scenario edit calculated twice. | **Resolved.** Scenario state stores the current calculation and last valid calculation from one transition. | `a9218f7`, `3857f1f`; state path in `src/App.tsx` and invalid-transition coverage in `e2e/sharing-errors.spec.ts`. |
| PERF-003 | Medium | Schedule rendering constructed thousands of formatters and mounted collapsed monthly tables. | **Resolved.** Currency formatters are cached and monthly rows mount only for the open year. | `856b35a`, `af3ec4f`; lazy-mount and role-reset cases in `e2e/accessibility.spec.ts`. |
| PERF-004 | Low | ExcelJS adds a large lazy chunk and transitive dependency graph. | **Resolved.** ExcelJS remains isolated behind the user-triggered XLSX path and workbook behavior has regression coverage; no custom writer was added. | `856b35a`; typed and disabled-data workbook cases in `src/lib/exports.test.ts`; download case in `e2e/exports.spec.ts`. |
| PERF-005 | None | The bounded daily OD ledger was not a measured bottleneck. | **Resolved.** The explicit daily ledger remains for auditability, with maximum-horizon and reconciliation coverage. | `8443a91`, `1e32c4d`; maximum supported loan and accounting invariants in `src/domain/loan/loan.test.ts`. |

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

| ID | Priority | Finding | Resolution | Commit and regression evidence |
|---|---|---|---|---|
| UX-001 | Medium | Several controls were below 44 px in one dimension. | **Resolved.** Interactive targets meet the 44 px minimum in the tested layouts. | `b45d96e`; six-viewport target and overflow checks in `e2e/accessibility.spec.ts`. |
| UX-002 | Medium | Errors were not programmatically tied to responsible inputs. | **Resolved.** Field-keyed issues drive inline messages, `aria-invalid`, and `aria-describedby`. | `a9218f7`, `3857f1f`; inline-error assertions in `e2e/sharing-errors.spec.ts`. |
| UX-003 | Low | Hint text became part of accessible names and caused partial-name ambiguity. | **Resolved.** Labels and descriptions have separate elements and explicit description references. | `a9218f7`, `3857f1f`; role/label locators across `e2e/app.spec.ts` and `e2e/sharing-errors.spec.ts`. |
| UX-004 | Medium | Collapsed schedule years still mounted monthly tables. | **Resolved.** Only the expanded year's table mounts. | `856b35a`, `af3ec4f`; lazy schedule cases in `e2e/accessibility.spec.ts`. |
| UX-005 | Low | Share provenance was easy to miss. | **Resolved.** Received valid fragments show a persistent verification notice until reset or local edits clear provenance. | `a9218f7`; provenance and cross-context round-trip cases in `e2e/sharing-errors.spec.ts`. |

## Security findings

The full repository-grounded analysis is in `loan_emi_calculator-threat-model.md`.

- No raw HTML insertion, eval/dynamic code, SSRF-capable request, remote runtime script, application secret, account boundary, database, or backend exists.
- URL fragments are the only remote attacker-controlled runtime entry point.
- Shared links intentionally disclose all encoded inputs to anyone who receives the URL.
- Build/deploy dependency execution is the primary privileged boundary.
- Build and deploy use separate jobs, so npm code runs without Pages write or OIDC permissions.
- GitHub Actions use immutable commit references, and Dependabot tracks action and npm updates.
- A meta CSP would not provide `frame-ancestors` protection and could complicate Vite development; with no runtime injection sink or remote content, it is not currently the highest-value control.

## Regression coverage after hardening

Unit tests now cover malformed and unknown shared-state fields, symmetric paise boundaries, duplicate IDs and rate dates, all three list caps, permanent net debt-free semantics, same-day OD attribution and atomic failures, every prepayment frequency, month-end anchoring, boundary inputs, mode bases, disabled optional data, maximum supported schedules, and randomized reconciliation. Playwright covers invalid-action blocking, provenance and cross-context sharing, lazy schedule mounting, six responsive dimensions, and the five configured browser projects. The workflow builds and tests the Pages subpath in an unprivileged job before the privileged deploy job receives the artifact.

The automated matrix uses browser engines and mobile emulation. Physical devices, screen readers, slow networks, and thermal/battery behavior remain manual residual checks.

## Maintenance assessment

- Keep Vite + React + TypeScript. Rewriting the working UI in vanilla JavaScript would trade a small bundle reduction for much greater regression and maintenance risk.
- Keep the pure financial engine outside React and preserve native controls/SVG/CSS.
- Keep ExcelJS lazy. Its latest stable release is older and has a large transitive graph, but replacing a standards-compliant XLSX writer with custom ZIP/XML code is the less maintainable choice.
- Keep the pinned Node/npm build toolchain, exact direct dependencies, `package-lock.json`, and clean `npm ci --ignore-scripts` path current.
- Keep the deployed product fully static with no service worker, backend, analytics, remote fonts, or runtime API dependency.
- Add a reproducible release verification command and archive a verified build artifact with each release if long-term rebuild independence becomes a requirement.
- Re-run this audit whenever a backend, authentication, telemetry, third-party runtime script, lender-specific guarantee, or regulated use is introduced.
