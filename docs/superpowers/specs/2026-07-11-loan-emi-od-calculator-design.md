# Loan EMI and Overdraft Calculator Design

## Purpose

Create a lender-neutral educational calculator for comparing a standard Indian home loan with an optional overdraft-linked loan. The calculator must make its assumptions visible, keep user data in the browser unless the user deliberately shares it, and avoid presenting estimates as lender statements or financial advice.

## Goals

- Calculate a standard monthly-reducing EMI and amortization schedule.
- Simulate OD interest from dated daily balances.
- Support optional opening surplus, fixed monthly surplus, and arbitrary dated deposits and withdrawals.
- Support interest-rate changes on selected EMI dates with two adjustment modes.
- Keep prepayments permanently reducing principal and OD deposits withdrawable.
- Compare standard and OD outcomes after OD-specific fees.
- Export consistent results to print/PDF, CSV, and typed XLSX.
- Run as a static GitHub Pages application with no backend.

## Non-goals

The first release will not reproduce a named lender product, fetch live rates, model construction-stage disbursements or pre-EMI, calculate tax benefits, underwrite affordability, save named local/cloud scenarios, calculate a break-even parked-surplus estimate, or provide financial advice. It will not embed charts in XLSX files.

## Architecture

The calculation pipeline is independent of React:

1. `LoanScenario` stores normalized, validated inputs and explicit assumptions.
2. An event builder emits a chronological ledger of loan start, EMI-cycle rate change, EMI-cycle prepayment, opening OD surplus, recurring OD surplus, arbitrary deposit, and arbitrary withdrawal events.
3. A daily OD engine processes the ledger using deterministic same-day ordering and Actual/365 interest.
4. A standard engine runs the equivalent non-OD loan using monthly-reducing interest.
5. An aggregator produces monthly and yearly schedules, totals, comparisons, chart series, and export models.
6. React collects inputs and renders results but contains no financial formulas.

The implementation has three source boundaries:

- `src/domain/loan`: types, validation, event generation, engines, and aggregation.
- `src/components`: form sections, result cards, tables, charts, and dialogs.
- `src/lib`: URL-fragment sharing, printing, CSV, and XLSX export.

## Domain model

The scenario contains property and loan inputs, homeowner costs, EMI-cycle prepayments and rate changes, OD configuration, and OD transactions. OD is disabled by default. When disabled, every OD value is ignored and the OD comparison must equal the standard result.

The standard engine tracks principal outstanding. The OD engine instead keeps only these balances:

- **Drawing power:** contractual maximum debit balance after scheduled reductions and permanent prepayments.
- **Parked surplus:** user funds deposited into the OD account and still withdrawable.
- **Available withdrawal:** the parked surplus currently available to withdraw.
- **Net utilized balance:** `max(drawing power - parked surplus, 0)`.
- **Accrued interest:** unposted daily interest accumulated since the previous posting date.

OD deposits never become prepayments. A prepayment permanently reduces drawing power and cannot later be withdrawn. Parked surplus above drawing power remains withdrawable but earns no additional interest benefit; the UI warns when this occurs.

## Defaults

- OD enabled: `false`.
- OD rate premium: `0%`.
- One-time OD setup/conversion fee: `₹0`, charged at loan start.
- Annual OD account fee: `₹0`, charged on each loan-start anniversary while the OD remains open.
- Opening parked surplus: `₹0`.
- Opening percentage basis: original sanctioned principal.
- Monthly parked surplus: `₹0`, deposited on the EMI day.
- Arbitrary dated transactions enabled: `false`.
- Rate-change mode: keep EMI and adjust tenure.
- Day-count convention: Actual calendar days divided by a fixed 365-day denominator, including during leap years.
- Currency: INR represented in paise; daily accrual may retain fractional paise, and posted interest is rounded half-up to the nearest paise once per monthly posting.
- Date representation: ISO `YYYY-MM-DD` parsed to an integer calendar-day index without local-time or daylight-saving arithmetic.

## Event processing

For every event date, the engine uses this order:

1. Apply a rate change effective at the start of the day.
2. On an EMI date, post OD interest accrued through the previous day.
3. Apply the scheduled transfer, first to posted interest, and reduce drawing power by the contractual principal component.
4. Apply permanent prepayments scheduled for that EMI date.
5. Apply opening or recurring OD surplus.
6. Net arbitrary deposits and withdrawals for that date.
7. Validate that total withdrawals do not exceed the day's opening available withdrawal plus same-day deposits.
8. Calculate interest for the current day on the closing net utilized balance.

Monthly OD interest is posted on the EMI date. Standard-loan interest remains monthly reducing. Rate changes and permanent prepayments are restricted to EMI dates so the standard engine does not imply unsupported mid-cycle repricing; arbitrary OD deposits and withdrawals may occur on any calendar date. Events after payoff are rejected during validation rather than silently ignored.

The scheduled OD transfer equals the standard EMI calculated for full utilization. Its contractual principal component reduces drawing power. Actual daily OD interest is charged separately; when the scheduled transfer exceeds actual interest plus the contractual principal reduction, the difference increases parked surplus and remains withdrawable.

## Rate changes

A rate change updates the annual rate on a selected EMI date. The user chooses one of two behaviors:

- **Keep EMI, adjust tenure:** default. Continue the current EMI and recompute the payoff date.
- **Keep tenure, recalculate EMI:** preserve the remaining payoff date and calculate a new EMI.

If the unchanged EMI does not cover accrued interest, the scenario is infeasible. The UI reports the minimum viable EMI and does not create negative amortization.

The effective OD rate is the active standard rate plus the OD premium. The premium applies to the full net utilized OD balance, not only to withdrawals beyond the original sanctioned amount.

## User interface

The app is one responsive page. Essential loan inputs appear first. Homeowner costs, prepayments, rate changes, OD, and arbitrary OD transactions are optional sections. Rate changes and prepayments select an EMI cycle; arbitrary OD transactions use native calendar dates. Enabling OD reveals the premium, effective rate, one-time setup fee, annual fee, opening parked surplus in rupees or percentage of original principal, and monthly contribution. Enabling arbitrary transactions reveals rows with date, deposit/withdrawal type, amount, and remove action, capped at 100 rows.

The calculated loan amount is read-only. Every percentage states its basis. Terminology uses “drawing power,” “parked surplus,” “available withdrawal,” and “net utilized balance,” avoiding the ambiguous phrase “OD balance.” Native date inputs, visible focus, keyboard operation, inline errors, and Reset are required.

## Results

The primary comparison shows standard EMI, effective OD rate, standard interest, OD interest, one-time and annual OD fees, fee-adjusted savings, and payoff dates. OD savings include only the difference in lender interest minus OD-specific fees. Supporting balances show drawing power, parked surplus, available withdrawal, net utilized balance, and accrued interest. Opening or recurring parked surplus is liquidity, not an upfront cost.

Costs remain separate:

- Upfront cash required.
- Principal paid to the lender.
- Interest paid to the lender.
- OD-specific fees; the rate premium is already reflected in OD interest.
- Homeowner expenses over the original contracted loan tenure, excluded from OD savings because they continue after loan payoff.
- Total modelled cash outflow.

The page includes one native-SVG cost-composition chart, one native-SVG balance timeline, and an expandable yearly-to-monthly amortization table. Each chart has a textual/table alternative.

## Persistence and privacy

Shared scenarios use a versioned URL fragment, not query parameters. The fragment is validated before use, rejected when its encoded length exceeds 8,000 characters, and is not automatically transmitted to the host. Sharing is always user-initiated. V1 does not persist named scenarios locally.

## Exports

The app provides all three actions:

- **Print / Save as PDF:** invokes the browser print flow with print-specific CSS.
- **Download CSV:** exports the raw monthly amortization schedule using ISO `YYYY-MM-DD` dates, decimal rupee amounts, decimal rates, and unformatted integer counts.
- **Download Excel (.xlsx):** lazy-loads ExcelJS only when requested and writes a structured workbook.

The XLSX workbook contains these sheets:

1. `Assumptions`
2. `Comparison Summary`
3. `Monthly Amortization`
4. `Yearly Summary`
5. `OD Transactions`

XLSX cells use native types:

- Dates are Excel date cells with date formats.
- Currency and balances are numeric cells with INR number formats.
- Rates are numeric percentage cells.
- Counts and tenure are integer cells.
- Flags are Boolean cells.
- Labels and explanatory assumptions are text cells.
- Derived totals are numeric cells or formulas where a formula improves auditability.

Headers are frozen and tabular sheets have filters. The workbook contains assumptions and the educational-estimate disclaimer. Numbers and dates are never exported as formatted strings. Web charts are not embedded in v1.

## Validation and error handling

Validation rejects missing required values, negative money values where not meaningful, invalid tenure or rate changes, rate changes or prepayments outside an EMI cycle, OD transactions before loan start or after payoff, more than 100 arbitrary OD transactions, withdrawals above available surplus, unsupported or over-8,000-character share fragments, unsafe numeric magnitudes, and EMIs that cannot cover interest. V1 accepts home value and principal above zero up to ₹100 crore, other money values from zero to ₹100 crore, tenure from 1 to 480 months, standard annual rates from 0% to 50%, OD premiums from 0% to 20%, and ordinary percentage inputs from 0% to 100%. A keep-EMI rate reset that would extend calculation beyond 600 months is rejected with a warning to increase EMI. These are calculator safety limits, not lending eligibility rules.

Errors appear beside the responsible input. Invalid calculations do not replace the last valid results. Malformed shared fragments are ignored with a warning. Print, CSV, and XLSX failures produce recoverable messages and never corrupt the active scenario.

## Testing

Vitest covers golden standard-loan cases, fractional-paise accumulation and monthly half-up posting, UTC-safe date conversion, OD-disabled equality, Actual/365 accrual, same-day event ordering, both rate-reset modes, infeasible EMI detection, opening and monthly surplus, arbitrary deposits and withdrawals, 100-event and fragment-length limits, one-time and annual fees, excess surplus, withdrawal caps, prepayment separation, fixed ownership-cost horizon, leap dates, early payoff, malformed fragments, and reconciliation invariants.

Export tests compare UI and schedule values with CSV output, then reopen the generated XLSX workbook to verify sheet names, cell values, native cell types, number formats, formulas, and totals. At least one standard and one OD fixture are cross-checked against an independent spreadsheet; a lender statement may be used only as an explicitly labelled reference fixture.

One Playwright smoke test runs against the built production preview and covers the primary desktop and mobile flow, OD and transaction toggles, rate-reset selection, sharing, print preparation, CSV, and XLSX download initiation.

## Deployment

Vite builds static files into `dist`. GitHub Actions runs lint, type-check, unit tests, build, and the Playwright production-preview smoke test before uploading `dist` to GitHub Pages from `main`. The repository name is fixed as `loan_emi_calculator`, but its owner is dynamic. The workflow sets `VITE_BASE_PATH` to `/${{ github.event.repository.name }}/` and `VITE_SITE_URL` to `https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/`; Vite consumes those build-time values, while runtime share links use `window.location.origin` plus `import.meta.env.BASE_URL`. A username or ownership change requires a manual workflow redeployment but no source edit. HTTPS is required, and custom domains are out of scope for v1. The repository's reuse license must be chosen explicitly before public release; no license is assumed by the design. Rollback redeploys a previously verified commit.

## Acceptance criteria

- Standard results reconcile with independent golden calculations.
- Disabling OD produces the standard result exactly.
- Arbitrary transaction dates affect OD interest by their actual active days.
- Both rate-reset modes produce deterministic schedules.
- Prepayments cannot be withdrawn; OD surplus can be withdrawn within limits.
- Daily interest accumulates fractional paise and rounds only at monthly posting.
- OD savings exclude parked liquidity and ownership expenses.
- UI, tables, charts, CSV, and XLSX reconcile to the same result model.
- XLSX dates and numbers are native typed cells, not display strings.
- No user data is sent to an application backend because no backend exists.
- The production build deploys successfully to the URL derived from the current `github.repository_owner` and repository name, with working assets and share fragments.
