# Section Cost and Payable Breakdown Design

**Date:** 2026-07-12
**Status:** Approved for implementation

## Objective

Show the financial effect of each applicable calculator section where the user configures it, then reconcile those figures in the overall repayment panel. Distinguish monthly cost, one-time cost, additional cash flow, financed charges, loan repayment, and all-in outflow without double-counting principal or prepayments.

## Design approach

Add one pure derived breakdown adapter over the existing validated `SuiteResult`. The adapter reuses native calculator outputs and schedule rows; it does not modify calculation engines, scenario schemas, sharing, or export formulas.

The same breakdown feeds:

- compact values in applicable guided sections;
- the overall repayment summary;
- future export work if explicitly requested later.

No new dependency or second donut chart is added. Existing currency formatting and the payment graph remain authoritative presentation primitives.

## Shared terminology

- **EMI:** the contractual initial monthly loan payment.
- **Recurring non-loan cost:** a non-recoverable monthly cost, including annual costs divided by 12.
- **Total ongoing monthly cost:** EMI plus recurring non-loan costs that occur during the same phase.
- **One-time cost:** a non-recoverable fee or expense paid or deducted once. It is never divided into the monthly total.
- **Additional cash flow:** prepayments, OD parked contributions, deposits, withdrawals, balloon obligations, or other principal/liquidity movements. These are shown separately from cost.
- **Financed one-time charge:** an amount included in principal. It appears in loan composition but is not added again to total payable.
- **Outside-loan upfront cost:** an amount paid or deducted outside scheduled repayment.
- **Total loan payable:** scheduled principal, interest, and lender charges, with financed/deducted charges counted exactly once.
- **Total overall cost for selected tenure:** gross all-in cash outflow across the selected contractual loan/repayment tenure: total loan payable plus contributions and non-loan costs, including one-time costs once and recurring costs for their modelled period. Recoverable liquidity and sale proceeds are excluded from this gross row.
- **Net overall cost:** total overall cost minus applicable proceeds such as expected resale value.

## Loan composition

Every calculator shows a loan composition table before payable totals.

### Generic

- Base principal: scenario principal.
- Financed one-time charges: zero.
- Total loan amount: scenario principal.

### Home

- Base property amount financed: calculated loan amount minus financed loan insurance.
- Financed one-time charges: financed loan insurance.
- Total loan amount: calculated loan amount.
- Down payment remains an outside-loan contribution.

### Car

- Base vehicle amount financed: vehicle price minus down payment.
- Financed one-time charges: financed insurance plus registration/on-road fees only when their financing toggle is enabled.
- Total financed principal: native financed principal.
- Non-financed registration and processing fee remain outside-loan upfront costs.

### Personal

- Net amount received: native net disbursed.
- Upfront deductions financed within requested principal: native total deductions.
- Total requested principal: scenario principal.
- Deductions are disclosed as charges but are not added again to scheduled repayment.

### Education

- Original principal disbursed: native total disbursed.
- Capitalized interest: native capitalized interest.
- Repayment-start principal: native repayment principal.
- Processing fee and own contribution remain outside this principal composition.

## Applicable section summaries

Each applicable `GuidedSection` receives a compact summary. Zero summaries stay hidden until the section has a configured financial effect.

| Calculator section | Cost values | Separate cash-flow values |
|---|---|---|
| Generic — Fees | Processing fee once | None |
| Generic — Repayment changes | None | Recurring prepayment monthly equivalent; one-time prepayments |
| Home — Ownership and lender costs | Monthly property tax, insurance, and maintenance; processing and purchase expenses once; cost over original tenure | None |
| Home — Repayment changes | None | Recurring prepayment monthly equivalent; one-time prepayments |
| Home — Overdraft facility | Annual OD fee divided by 12; setup fee once; total OD fees | Monthly parked contribution and dated deposits/withdrawals |
| Car — On-road financing | Processing fee and non-financed registration once | Financed registration/insurance disclosed as principal composition |
| Car — Balloon and ownership horizon | None | Balloon obligation once; expected resale proceeds separately |
| Car — Repayment changes | None | Recurring prepayment monthly equivalent; one-time prepayments |
| Personal — Upfront deductions | Processing fee, GST, insurance, and other deductions once | None |
| Personal — Prepayments | None | Recurring prepayment monthly equivalent; one-time prepayments |
| Education — Study funding | None | Own contribution once; dated lender disbursements as principal funding |
| Education — Moratorium servicing | Serviced interest total; fixed monthly amount or actual average monthly servicing | None |
| Education — Repayment | Processing fee once | Repayment EMI; recurring prepayment monthly equivalent; one-time prepayments |

Recurring prepayment monthly equivalents use the declared frequency: monthly amount, quarterly amount divided by 3, and yearly amount divided by 12. One-time prepayments stay one-time. This is labelled an equivalent and does not imply the lender collects it every month.

OD parked contributions and deposits remain withdrawable liquidity and must never be labelled or summed as expense. Withdrawals are shown as reductions in planned parked cash, not negative cost.

Education study servicing and repayment EMI occur in different phases. They are shown as phase-specific monthly amounts and are not added together as though concurrent.

## Overall repayment panel

The existing EMI headline remains. Add three compact groups below it.

### Monthly view

- EMI.
- Recurring non-loan costs, itemized where nonzero.
- Total ongoing monthly cost.
- Planned extra monthly cash flow, separate and excluded from cost.

### Total payable view

- Total loan/principal amount.
- Total interest.
- Total other charges.
- Total loan payable.
- Upfront contribution or outside-loan cash, where applicable.
- Total overall cost for the selected tenure, with the selected month/year span in its label.
- Proceeds and net overall cost, where applicable.

### Section reconciliation

List each configured section's monthly cost, one-time cost, total cost, and separate cash flow. The figures use the same derived objects displayed in the section itself.

## Calculator reconciliation rules

### Generic

- Total loan payable = principal + total interest + processing fee.
- Total other charges = processing fee.
- Total overall cost for selected tenure = total loan payable across the actual repayment schedule generated from that selected tenure.

### Home

- Standard total loan payable = loan amount + standard interest + processing fee.
- Total other charges = processing fee + one-time purchase expenses + ownership cost over original tenure.
- Total overall cost for selected tenure = existing standard total modelled outflow: standard repayment plus upfront contribution/charges and ownership costs across the selected original contractual tenure, even if prepayment shortens the loan schedule under existing Home semantics.
- Down payment is shown as upfront contribution, not lender payment.
- If OD is enabled, show OD fees and existing OD total modelled outflow as a labelled comparison; do not replace the standard baseline silently.

### Car

- Full-schedule loan payable = sum of scheduled payment and prepayment rows plus processing fee.
- Total other charges = processing fee + non-financed registration/on-road fees.
- Total overall cost for selected tenure = scheduled loan payable + down payment + non-financed registration/on-road fees across the selected loan tenure.
- Existing ownership-horizon cash outflow remains separately labelled.
- Expected resale is a proceed; net ownership cost remains the horizon outflow minus resale.
- Balloon and prepayments are already contained in schedule repayment and are not added twice.

### Personal

- Total loan payable = native total repayment.
- Total other charges = native total deductions.
- Net amount received + deductions = requested principal.
- Deductions are already contained within requested principal and are not added again to total repayment.
- Effective borrowing cost = total loan payable minus net amount received.
- Total overall cost for selected tenure = native total repayment across the selected tenure; deductions remain disclosed within requested principal and are not added twice.

### Education

- Total interest = serviced interest + capitalized interest + repayment interest.
- Total other charges = processing fee.
- Total loan payable = existing native total cost.
- Total overall cost for selected tenure = gross lifecycle outflow across study, moratorium, and the selected repayment tenure: native total cost + own contribution.
- Capitalized interest is shown in principal composition and total interest but is paid once through repayment principal, not added twice.

## Validation, rounding, and stale results

- Derive breakdowns only from finite validated results.
- Use the existing money rounding helper at aggregation boundaries.
- When current input is invalid, follow the existing last-valid-result behavior and keep the same stale-result notice.
- Missing or zero categories remain absent rather than creating noisy ₹0 rows, except the principal and required total rows.
- Every displayed grand total must reconcile to its displayed components under the no-double-counting rules above.

## Presentation and accessibility

- Section summaries use short text such as `₹3,750/mo · ₹5,12,500 once` and remain readable when the section is collapsed.
- Inside an open section, use a small definition list with explicit labels rather than relying only on color.
- The overall summary uses semantic headings and definition lists.
- Values retain Indian currency grouping and tabular numerals.
- Avoid hover-only information; every value remains keyboard, touch, and screen-reader accessible.
- Preserve mobile horizontal-fit, print output, reduced motion, and invalid-state action blocking.

## Verification

- Unit-test one golden breakdown per calculator and no-double-counting cases for prepayment, balloon, deductions, capitalized interest, and OD liquidity.
- Verify section summaries update after toggles and amount/percentage edits.
- Verify the overall monthly total excludes one-time costs, prepayments, and parked OD funds.
- Verify total loan payable, total overall cost for selected tenure, and net overall cost reconcile for every calculator.
- Run the full unit suite, five-project Playwright matrix, Pages subpath matrix, responsive overflow checks, and production audit.

## Non-goals

- A second donut/pie chart.
- Changing loan formulas, schedules, exports, sharing, or stored scenario formats.
- Treating prepayment or OD liquidity as cost.
- Amortizing one-time costs into monthly totals.
- Lender-specific tax or accounting advice.
