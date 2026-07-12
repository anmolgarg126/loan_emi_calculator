# AI Context

Loan EMI Calculator is a static, lender-neutral loan planning suite built with React, TypeScript, Vite, plain CSS, native SVG, and lazy-loaded ExcelJS. It runs entirely in the browser and deploys to GitHub Pages.

## Sources of truth

1. `docs/superpowers/specs/2026-07-12-calculator-suite-redesign-design.md` defines the approved suite semantics and UX.
2. `plan.md` contains the implementation tasks and acceptance gates.
3. `src/domain/calculators/` owns calculator-specific validation and results.
4. `src/domain/amortization/` owns reusable reducing-balance schedules.
5. `src/domain/loan/` remains authoritative for the audited Home/OD model.
6. `README.md` contains setup, verification, privacy, and deployment guidance.

## Product invariants

- Calculators: Generic, Home, Car, Personal, and Education. Solvers: Affordability, Tenure, Interest Rate, and Prepayment.
- Financial formulas stay outside React. Shared consumers use the discriminated suite scenario/result contract.
- Home OD is optional and off by default. The extra OD rate defaults to zero. Opening parked funds support amount or percentage; dated deposits/withdrawals and monthly contributions are separately optional.
- Rate changes default to keeping EMI and adjusting tenure. Where valid, both keep-EMI and keep-tenure modes remain available.
- Standard loans are monthly reducing balance. Home OD is Actual/365 daily rest. Education study/moratorium accrual is Actual/365 simple interest on disbursed outstanding. Personal flat-rate mode must remain visibly distinct from effective APR.
- Car resale value never silently reduces principal. A balloon is a visible contractual final payment.
- Every user-created list is capped at 100 entries. External shared or stored state is parsed strictly and rejected atomically when invalid.
- Share state uses a versioned URL fragment capped at 8,000 characters. V1 Home fragments remain readable; new suite fragments use V2.
- Tabs do not synchronize. Calculations and transient state are memory-local to the tab. A saved snapshot uses `localStorage` only after explicit Remember, and another tab restores it only after explicit Restore.
- No backend, authentication, analytics, telemetry, cookie, remote script/font, service worker, runtime fetch, or automatic transmission of financial inputs.
- CSV is machine-readable. XLSX uses native typed date, number, percentage, integer, and Boolean cells.
- Reset affects the entire active calculator and offers a 10-second in-memory undo. Deleting a remembered snapshot requires confirmation and does not reset the active calculation.

## Repository map

```text
src/domain/amortization/  Shared schedule engine
src/domain/calculators/   Suite types, calculators, solvers, performance tests
src/domain/loan/          Audited Home/OD financial engine
src/components/           Guided forms, summary, graph, schedule, shell
src/lib/                  Strict codecs, explicit persistence, sharing, exports
src/App.tsx               Per-tab orchestration and lazy boundaries
src/styles.css            Calm teal responsive and print design system
e2e/                      Cross-browser journeys, privacy, graph, export, a11y
.github/workflows/        Verified GitHub Pages deployment
```

## Change discipline

- Prefer a direct typed function or native browser feature over a dependency or speculative abstraction.
- Blocking validation returns field-keyed issues and empty invalid schedules. The UI may display the last valid result but must disable share, print, and downloads until current inputs are valid.
- Preserve UTC calendar-day date arithmetic, paise rounding rules, same-day event ordering, list caps, schedule reconciliation, and Home parity tests.
- Preserve visible focus, labels/descriptions, chart text/table alternatives, keyboard/touch graph access, reduced motion, print output, and 320–375 px usability.
- Keep graph/schedule, solvers, share/storage parsers, and ExcelJS lazy. The default production view must stay within the 85 kB gzip JS+CSS budget.
- A backend, accounts, telemetry, remote runtime content, lender-specific guarantee, or regulated use requires a new approved design and threat-model update.

## Commands

```sh
nvm use
npm ci --ignore-scripts
npm run dev
npm run verify
npx playwright install chromium firefox webkit
npm run test:e2e
```

GitHub Actions derives the Pages base path from the repository name and the site URL from `github.repository_owner`. After an owner/username change, rerun the workflow; do not hard-code an owner.
