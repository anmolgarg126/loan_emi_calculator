# Loan Ledger

A lender-neutral Indian home-loan EMI and overdraft calculator. It models monthly-reducing EMI, dated rate changes and prepayments, daily OD interest, ownership costs, amortization, and typed exports without sending financial inputs to a backend.

## Run locally

Use Node 24.18.x and npm 11.16.x. The exact npm version is recorded in `package.json`; `.nvmrc` selects Node 24.18.0.

```sh
nvm use
npm ci --ignore-scripts
npm run dev
```

Open the local URL printed by Vite.

## Verify

Start from a clean checkout, then run the same install and non-browser verification used by CI:

```sh
npm ci --ignore-scripts
npm run verify
npx playwright install chromium firefox webkit
npm run test:e2e
```

`npm run verify` runs lint, type-checking, unit tests, and the production build. The Playwright command runs five configured projects: desktop Chromium, Firefox, and WebKit plus Pixel 5 Chrome and iPhone 13 WebKit emulation.

To verify the GitHub Pages subpath locally, replace `YOUR_GITHUB_OWNER` and run:

```sh
export OWNER=YOUR_GITHUB_OWNER
VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL="https://${OWNER}.github.io/loan_emi_calculator/" npm run build
VITE_BASE_PATH=/loan_emi_calculator/ npm run test:e2e
```

The browser suite checks responsive layouts, keyboard focus, reduced motion, touch-target dimensions, share/error flows, lazy schedules, and exports through automated desktop browsers and mobile emulation. It does not replace testing on physical phones, with a screen reader, or by a person reviewing the financial workflow. Slow-network and thermal/battery behavior also remain manual residual checks.

## Exports

- Print / Save as PDF uses the browser print flow.
- CSV contains machine-readable monthly amortization.
- XLSX contains typed Assumptions, Comparison Summary, Monthly Amortization, Yearly Summary, and OD Transactions sheets.

## Deployment

Pushes to `main` are verified and deployed through GitHub Actions. The build job has read-only repository access; only the separate deploy job receives Pages and OIDC write permissions. The live URL is derived automatically:

`https://<current-repository-owner>.github.io/loan_emi_calculator/`

Before the first public release, choose either an MIT license or no license/all rights reserved. Then authenticate GitHub CLI as the intended owner and run:

```sh
gh repo create loan_emi_calculator --public --source=. --remote=origin
gh api --method POST repos/{owner}/{repo}/pages -f build_type=workflow
git push -u origin main
```

The second command enables GitHub Actions as the Pages source before the first push. The workflow then verifies and deploys the app over HTTPS.

The repository owner comes from the GitHub Actions context; it is not stored in source. After a GitHub username or ownership change, run `gh workflow run deploy.yml`, wait for it to pass, and verify the newly derived URL. No source edit is required.

To roll back a faulty release, revert the faulty commit on `main`, push the revert, and verify the Pages workflow and live endpoint again.

## Important assumptions

- OD interest uses lender-neutral Actual/365 daily rest.
- Rate changes and prepayments occur on EMI-cycle dates.
- Ownership costs stay constant and never inflate OD savings.
- Results are educational estimates; verify them against lender terms.

See [plan.md](./plan.md), the [approved design](./docs/superpowers/specs/2026-07-11-loan-emi-od-calculator-design.md), and [AI_CONTEXT.md](./AI_CONTEXT.md).
