# Loan Ledger

A lender-neutral Indian home-loan EMI and overdraft calculator. It models monthly-reducing EMI, dated rate changes and prepayments, daily OD interest, ownership costs, amortization, and typed exports without sending financial inputs to a backend.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Exports

- Print / Save as PDF uses the browser print flow.
- CSV contains machine-readable monthly amortization.
- XLSX contains typed Assumptions, Comparison Summary, Monthly Amortization, Yearly Summary, and OD Transactions sheets.

## Deployment

Pushes to `main` are verified and deployed through GitHub Actions. The live URL is derived automatically:

`https://<current-repository-owner>.github.io/loan_emi_calculator/`

The repository owner comes from the GitHub Actions context. After a username change, manually rerun the deployment workflow.

## Important assumptions

- OD interest uses lender-neutral Actual/365 daily rest.
- Rate changes and prepayments occur on EMI-cycle dates.
- Ownership costs stay constant and never inflate OD savings.
- Results are educational estimates; verify them against lender terms.

See [plan.md](./plan.md), the [approved design](./docs/superpowers/specs/2026-07-11-loan-emi-od-calculator-design.md), and [AI_CONTEXT.md](./AI_CONTEXT.md).
