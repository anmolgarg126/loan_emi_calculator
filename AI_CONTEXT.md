# AI Context

Loan Ledger is a static, lender-neutral Indian home-loan EMI and overdraft calculator built with Vite, React, TypeScript, native SVG charts, and lazy-loaded ExcelJS. It runs entirely in the browser and deploys to GitHub Pages.

## Sources Of Truth

Read these before changing behavior:

1. `docs/superpowers/specs/2026-07-11-loan-emi-od-calculator-design.md` defines approved product semantics and acceptance criteria.
2. `plan.md` defines implementation scope and deferred features.
3. `src/domain/loan/index.ts` is the executable financial model.
4. `README.md` contains setup, verification, and deployment commands.

Keep this file concise. Update the design first when financial behavior changes, then update tests and implementation together.

## Product Invariants

- V1 is lender-neutral and educational, not a reproduction of a bank product or financial advice.
- Standard loans use monthly-reducing interest. Rate changes and permanent prepayments occur only on EMI-cycle dates.
- OD interest uses Actual/365 daily rest on `max(drawingPower - parkedSurplus, 0)`.
- OD is off by default. Arbitrary OD transactions are separately toggled off by default and capped at 100.
- Parked surplus is withdrawable liquidity, never a prepayment or an upfront cost.
- Prepayments permanently reduce drawing power and cannot be withdrawn.
- OD savings include lender-interest difference minus one-time and annual OD fees. Ownership costs and parked liquidity are excluded.
- Ownership costs remain constant over the original contracted tenure, even when the loan pays off early.
- Dates are ISO `YYYY-MM-DD` converted through UTC calendar-day arithmetic. Do not use local-time date math in the financial engine.
- EMI-cycle dates are converted once to direct cycle indexes. Recurrence checks use integer interval arithmetic rather than scanning candidate dates.
- Rate changes, prepayments, and arbitrary OD transactions are each capped at 100 entries.
- Daily interest may retain fractional paise. Posted money uses symmetric round-half-away-from-zero to paise, which is half-up for non-negative amounts; `10.075` becomes `10.08` and `-10.075` becomes `-10.08`.
- Same-day OD processing posts prior-day interest, applies the scheduled transfer and permanent prepayment, credits recurring surplus, then nets arbitrary deposits before withdrawals. An EMI-date row includes every flow from that date.
- Net debt-free means the first calendar day after the final day with positive net utilization, and is reported only when the simulated horizon ends debt-free. A temporary full offset before a later withdrawal does not qualify.
- Share state belongs in a versioned URL fragment and must never exceed 8,000 characters. The decoder reads declared fields only and rejects the whole fragment if any supplied declared field, nested object, list member, or list ID has an invalid type or shape; unknown fields are discarded.
- No backend, accounts, analytics, telemetry, remote scripts, or automatic transmission of financial inputs.
- CSV values remain machine-readable. XLSX dates, numbers, percentages, integers, and Booleans must remain native typed cells.

## Repository Map

```text
src/domain/loan/    Financial types, validation, standard engine, daily OD engine
src/components/     Charts and amortization schedule
src/lib/            URL-fragment sharing and CSV/XLSX exports
src/App.tsx         Form state, progressive disclosure, results, and actions
src/styles.css      Precision-ledger visual system, responsive and print CSS
e2e/                Playwright production-build smoke test
.github/workflows/  GitHub Pages verification and deployment
docs/superpowers/   Approved design specification
plan.md             Implementation scope
```

## Change Discipline

- Financial formulas stay outside React.
- Prefer focused typed functions over new abstractions or dependencies.
- Validate the complete scenario before building schedules. Blocking issues return field-keyed errors and empty schedules; the UI keeps the last valid result and disables print, sharing, and downloads. A same-day OD withdrawal failure does not commit that date's schedule row or fee.
- Keep input labels and result terminology aligned with the design: drawing power, parked surplus, available withdrawal, and net utilized balance.
- Do not reintroduce break-even estimates, named local scenarios, pre-EMI, tax advice, custom lender presets, or cloud storage without a new approved design.
- Update golden tests whenever rounding, event order, payment allocation, fees, or date rules change.
- Preserve chart table/text alternatives, keyboard access, visible focus, reduced-motion behavior, and 375 px mobile usability.
- Keep charts native SVG and ExcelJS lazy-loaded so neither requires a heavy initial chart/export bundle.

## Commands

```sh
nvm use
npm ci
npm run dev
npm run verify
npx playwright install chromium firefox webkit
npm run test:e2e
```

Use `npm ci --ignore-scripts` when reproducing CI exactly. The Playwright suite expects a completed `dist` build, starts `vite preview` automatically, and runs desktop Chromium, Firefox, WebKit, Pixel 5 Chrome emulation, and iPhone 13 WebKit emulation. Physical-device, screen-reader, slow-network, and thermal/battery checks remain manual.

## Deployment

The repository name is fixed as `loan_emi_calculator`; the owner is dynamic. GitHub Actions derives:

- `VITE_BASE_PATH` from `/${{ github.event.repository.name }}/`
- `VITE_SITE_URL` from `https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/`

Runtime share URLs use `window.location.origin` plus `import.meta.env.BASE_URL`. After an owner/username change, manually rerun the deployment workflow; no source edit is required.

For a new repository, create the remote without pushing, enable Pages with `gh api --method POST repos/{owner}/{repo}/pages -f build_type=workflow`, and then push `main`. This avoids the first workflow run failing because Pages has not been enabled yet.

Do not create or push the public repository until the user has confirmed the licensing choice in `plan.md`.
