# Loan Ledger Hardening Audit

Date: 2026-07-11

## Calculator suite release update — 2026-07-12

The approved redesign expands the original Home/OD calculator into Generic, Home, Car, Personal, and Education calculators plus Affordability, Prepayment, Tenure, and Interest Rate solvers. The audited Home/OD engine and its lender-neutral semantics remain intact. New shared amortization, specialist-calculator, strict V2 state, explicit local restore, graph, schedule, and typed-export boundaries have focused regression coverage.

| Release gate | Result |
|---|---:|
| TypeScript + ESLint | Pass |
| Unit and deterministic performance tests | 282/282 pass across 15 files |
| Root production browser matrix | 175/175 pass |
| GitHub Pages `/loan_emi_calculator/` matrix | 175/175 pass |
| Browsers | Chromium, Firefox, WebKit, Pixel 5 emulation, iPhone 13 emulation |
| Initial JS + CSS transfer | 77,196 bytes, below the 85,000-byte budget |
| Initial DOM | 151 elements for the default view |
| Desktop/mobile overflow audit | None at 1440×900 or 375×812 |
| Production dependency audit | 0 known vulnerabilities |

The graph and schedule load when the user reaches the analysis section. Solvers, exports, and ExcelJS remain action-triggered lazy chunks. Share and explicit remember/restore parsing stay synchronous because correctness and deterministic user actions are worth the measured 1,985-byte startup difference. ExcelJS is still isolated from startup and downloaded only for XLSX export.

### Calculator performance fixtures

Each supported-maximum fixture runs in the committed deterministic performance test. The recorded local Node 24.18.0 medians/maxima were: Generic 0.169/0.251 ms, Home maximum 1.992/4.450 ms, Car 0.309/0.452 ms, Personal 0.259/0.429 ms, and Education 1.336/1.612 ms. These are local regression measurements, not end-user latency guarantees.

### Privacy and isolation result

The runtime has no backend, account, cookie, analytics, remote asset, service worker, fetch/WebSocket, or storage-event synchronization. Active scenarios and calculations are isolated per tab and per machine. A versioned `localStorage` snapshot is created only by **Remember**, is never automatically applied, and enters another tab only after **Restore saved**. Share fragments and local downloads leave the active tab only after explicit user actions.

Baseline scope: committed application at `5df8c28` plus read-only audit scripts outside the repository. Resolution evidence below covers hardening commits through `ed64e45`; final completion evidence was measured from the exact tree `ed64e4588448e51a2dd23f88a7404a373505beb3` on 2026-07-12.

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

## Final completion evidence

The destructive release gate ran from `/tmp/loan-hardening-audit-ed64e45`, created with `git archive HEAD` while the source worktree resolved to `ed64e4588448e51a2dd23f88a7404a373505beb3`. The archive began without `node_modules`, `dist`, `test-results`, or `playwright-report`, so ignored files in the source worktree could not affect the result. Node 24.18.0 for Darwin arm64 was downloaded from the official Node distribution and matched SHA-256 `e1a97e14c99c803e96c7339403282ea05a499c32f8d83defe9ef5ec66f979ed1`; npm 11.16.0 was installed into the same temporary toolchain prefix.

| Command | Result |
|---|---:|
| `npm ci --ignore-scripts` | Pass; 282 packages; 0 vulnerabilities |
| `npm run verify` | Pass; lint, type-check, 82 unit tests, and production build |
| `npx playwright install chromium firefox webkit` | Pass |
| `npm run test:e2e` | Pass; 75/75 across desktop Chromium, Firefox, WebKit, Pixel 5 Chromium emulation, and iPhone 13 WebKit emulation |
| `npm audit --omit=dev` | Pass; 0 vulnerabilities |
| `git diff --check` | Pass |
| `VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL=https://owner.github.io/loan_emi_calculator/ npm run build` | Pass |
| `VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL=https://owner.github.io/loan_emi_calculator/ npm run test:e2e` | Pass; 75/75 from the Pages subpath |

After the final whole-branch review corrected the derived-principal ceiling and XLSX assumption formats in `e7f1211`, the release gates were repeated from a fresh `git archive` of that commit in `/tmp/loan-hardening-final-hhtzZU` with the same pinned Node/npm toolchain. `npm ci --ignore-scripts` again installed 282 packages with 0 vulnerabilities; `npm run verify` passed lint, type-check, 84 unit tests, and the production build; the root browser matrix passed 75/75; and the exact Pages-subpath build and browser matrix passed 75/75. The initial application payload at this final HEAD was 75.11 kB JavaScript plus 4.24 kB CSS gzip; ExcelJS remained a separate user-triggered 256.47 kB gzip chunk.

### Supported-maximum performance

The benchmark used the committed fixtures in `src/domain/loan/loan.test.ts`: `defaultScenario()`; the maximum supported OD scenario (`₹1,000,000,000`, 0 down payment in amount mode, 50% annual rate, 480 months, `2026-01-01`, OD enabled); and the 480-month scenario with 100 yearly ₹1 recurring prepayments starting at the committed four-month offsets. Under Node 24.18.0, each fixture ran once as an unmeasured warm-up and then 25 times in one process. Each sample wrapped only `calculateLoan(scenario)` with `performance.now()` from `node:perf_hooks`; the median is the 13th sorted sample and the maximum is the largest sample.

| Fixture | Runs | Median | Maximum | Budget |
|---|---:|---:|---:|---:|
| Default | 25 | 0.429 ms | 0.665 ms | median <2 ms; every run <100 ms |
| Maximum OD | 25 | 1.847 ms | 3.511 ms | median <20 ms; every run <100 ms |
| 100 recurring prepayments | 25 | 1.364 ms | 1.620 ms | median <20 ms; every run <100 ms |

These local single-process timings are regression evidence, not end-user latency measurements.

### Production visual inspection

The exact Pages build was served with Vite preview and inspected in headless Chromium. Full-page screenshots at 1440×900, 375×812, 320×568, and 812×375, plus expanded-OD, invalid-input, two-year-expanded schedule, keyboard-focus, and print-media states, are in the gitignored local directory `test-results/final-audit-ed64e45/`. Every captured screen had `document.documentElement.scrollWidth === clientWidth`, no console or page errors, and exactly two same-origin runtime resources (the built JS and CSS). The default hierarchy remained legible; expanded OD controls and a dated transaction remained contained at 375 px; the 320 px error state connected the inline error and disabled all four stale-result actions; two expanded schedule years mounted two tables without page clipping; and the keyboard skip link showed a solid 3 px orange focus outline.

Print-media emulation hid the header, input panel, status, actions, and footer while retaining the result, charts, all 21 yearly summaries, and the currently expanded first year's four mounted monthly rows. This confirms the committed native print CSS and lazy schedule DOM interaction, not operating-system print-dialog pagination or a saved physical/PDF output. Physical-device, screen-reader, actual print-preview, slow-network, and thermal/battery checks were not available and remain manual residual work.

### Final security review

The `5df8c28..ed64e45` changed source and workflow files were scanned with `rg` for raw HTML insertion, `eval`/dynamic code, remote scripts and runtime network APIs, credentials and secret-like strings, shell/process execution, URL and expression interpolation, and workflow permissions. No exploitable sink, secret, unexpected runtime request, or command interpolation was found. The sole source `.exec` match was the fixed date-validation regular expression. The only committed remote URL is the expected owner/repository-derived Pages URL; those GitHub expressions are not shell commands. All workflow actions use immutable 40-character commit references. The build job retains only `contents: read`; `pages: write` and `id-token: write` exist only on the deploy job, after verified artifact production. Reinspection of the fragment decoder, calculation/validation engine, export boundary, and deployment workflow found the documented TM-001 through TM-005 controls intact and TM-006 unchanged as an accepted low residual risk. A second `npm audit --omit=dev` reported 0 vulnerabilities.

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
