# Loan EMI Calculator

A lender-neutral, privacy-first loan planning suite for Generic, Home, Car, Personal, and Education loans. It includes four reverse solvers, prepayments and rate changes, a detailed Home Loan overdraft model, an interactive payment graph, amortization schedules, and typed exports.

Every input and calculation stays in the current browser tab. The app has no backend, account, analytics, cookies, remote fonts, or runtime API calls. A scenario leaves the tab only when the user explicitly copies a share link or downloads/prints an export.

## Features

- Generic loan EMI with fees, rate changes, and prepayments.
- Home loan with ownership costs and optional OD modelling. OD is off by default; the OD premium defaults to zero and the opening parked amount supports amount or percentage entry.
- Optional OD opening balance, fixed monthly contribution, and arbitrary dated deposits or withdrawals.
- Car loan with on-road costs, financed insurance, balloon payment, resale value, and ownership-cost estimate.
- Personal loan with reducing/flat quotation modes, deductions, net disbursal, and effective APR.
- Education loan with dated disbursements, study/moratorium accrual, interest servicing, capitalization, and repayment.
- Affordability, tenure, interest-rate, and prepayment solvers.
- Interactive yearly/monthly graph linked to the schedule, with series controls, ranges, OD comparison, keyboard navigation, and touch tooltips.
- Replaceable amount inputs with Indian lakh/crore grouping and compact rupee words; percentage-based amounts show their calculated rupee equivalent.
- Full-calculator reset with a 10-second undo; explicit remember, restore, and confirmed delete on the current device.
- Print/PDF, machine-readable CSV, and XLSX with native date, number, percentage, integer, and Boolean cells.

### Editing amounts

Monetary inputs show Indian grouping such as `1,23,45,678` when not being edited. Focusing a field selects its current value and temporarily shows plain digits for predictable cursor editing, so replacing zero never produces a leading `0`. Clearing a field is allowed; leaving it empty commits zero on blur. A small line below each amount spells out the rupee value, while percentage-based amount fields show the calculated rupee equivalent. Pure rates and month counts remain ordinary numeric fields.

## Run locally

Use Node 24.18.x and npm 11.16.x. The versions are pinned in `.nvmrc` and `package.json`.

```sh
nvm use
npm ci --ignore-scripts
npm run dev
```

Open the local URL printed by Vite.

## Clean generated files

```sh
npm run clean
```

This removes build output, coverage, browser-test reports, TypeScript build metadata, and local tool caches. It deliberately preserves `node_modules`, environment files, source files, Git data, worktrees, and browser storage.

## Verify

```sh
npm ci --ignore-scripts
npm run verify
npx playwright install chromium firefox webkit
npm run test:e2e
```

`npm run verify` runs lint, type-checking, unit tests, and a production build. Playwright covers desktop Chromium, Firefox, and WebKit plus Pixel 5 and iPhone 13 emulation.

To test the exact GitHub Pages subpath:

```sh
export OWNER=YOUR_GITHUB_OWNER
VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL="https://${OWNER}.github.io/loan_emi_calculator/" npm run build
VITE_BASE_PATH=/loan_emi_calculator/ npm run test:e2e
```

## Deployment

Pushes to `main` are verified and deployed by GitHub Actions. The live endpoint is derived from the repository owner at build time:

`https://<github-username>.github.io/loan_emi_calculator/`

The username is not hard-coded. If the repository owner or username changes, rerun the deployment workflow; the new endpoint is generated automatically without a source edit.

GitHub Pages can deploy from a private repository when the account/organization plan supports private-repository Pages. The published Pages site itself should be treated as public unless GitHub Enterprise access controls are explicitly configured.

For a new remote:

```sh
gh repo create loan_emi_calculator --private --source=. --remote=origin
gh api --method POST repos/{owner}/{repo}/pages -f build_type=workflow
git push -u origin main
```

Change `--private` to `--public` if desired. The workflow uses read-only repository access for verification; only the separate deployment job receives Pages and OIDC write permissions.

## Financial assumptions

- Standard loans use monthly reducing-balance interest unless a calculator explicitly labels another quotation model.
- Home OD interest uses lender-neutral Actual/365 daily rest on net utilization.
- Rate changes default to keeping EMI unchanged and adjusting tenure; eligible flows also offer keeping tenure and adjusting EMI.
- Ownership costs and estimated resale values are displayed separately from loan principal and interest.
- Results are educational estimates. Confirm lender-specific rules, taxes, fees, day-count conventions, and repayment terms before making a financial decision.

See [plan.md](./plan.md), the [approved suite design](./docs/superpowers/specs/2026-07-12-calculator-suite-redesign-design.md), and [AI_CONTEXT.md](./AI_CONTEXT.md).
