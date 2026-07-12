# Loan Calculator Suite Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Loan Ledger into a calm, client-only calculator suite with Generic, Home, Car, Personal, and Education calculators, four solver tools, an interactive payment graph, explicit local restore, and the existing audited Home/OD behavior.

**Architecture:** Keep the audited Home Loan/OD engine intact while extracting its standard amortization path behind a small shared domain contract. Add calculator modules as discriminated TypeScript scenarios, normalize their results for shared UI/export/chart consumers, and keep calculator selection in `?calculator=` with versioned share fragments. React owns only per-tab presentation state; calculations, parsing, persistence codecs, graph aggregation, and exports remain pure or boundary-focused modules.

**Tech Stack:** React 19, TypeScript 5, Vite 8, plain CSS, dependency-free SVG, Vitest, Playwright, lazy-loaded ExcelJS, GitHub Pages, Node 24.18.0, npm 11.16.0.

**Source of truth:** `docs/superpowers/specs/2026-07-12-calculator-suite-redesign-design.md`

---

## Delivery constraints

- Preserve all 84 existing unit tests and the audited Home/OD outputs.
- Add no router, UI framework, chart library, state manager, remote font, backend, analytics, cookie, service worker, or runtime network request.
- Keep OD disabled by default and keep-EMI/adjust-tenure as the default rate-reset behavior.
- Cap every user-created list at 100 entries and reject malformed external data atomically.
- Use test-driven development for every task: red test, minimal implementation, green verification, focused commit.
- Keep the app deployable after every task; calculator modules land one at a time.
- Keep initial JavaScript plus CSS below the existing 85 kB gzip budget unless a measured exception is approved.

## Planned file structure

### Shared domain

- Create `src/domain/amortization/index.ts`: reusable reducing-balance schedule engine and balloon support extracted from the existing Home standard schedule.
- Create `src/domain/amortization/amortization.test.ts`: parity, balloon, rate-change, prepayment, and payoff tests.
- Create `src/domain/calculators/types.ts`: discriminated suite scenario/result contracts.
- Create `src/domain/calculators/generic.ts`: Generic defaults, validation, and calculation adapter.
- Create `src/domain/calculators/car.ts`: Car scenario, balloon, resale, and ownership-cost calculation.
- Create `src/domain/calculators/personal.ts`: flat/reducing comparison, deductions, and effective APR.
- Create `src/domain/calculators/education.ts`: disbursement, study/moratorium accrual, servicing, capitalization, and repayment.
- Create `src/domain/calculators/solvers.ts`: affordability, tenure, implied-rate, and prepayment solvers.
- Create `src/domain/calculators/index.ts`: calculator defaults and switch-based calculation dispatch.
- Create focused `*.test.ts` files beside each calculator module.
- Modify `src/domain/loan/index.ts`: call the shared amortization engine without changing Home/OD behavior.

### State and boundaries

- Create `src/lib/suite-codec.ts`: strict versioned parser/serializer shared by URL and remembered snapshots.
- Create `src/lib/remembered-scenario.ts`: explicit local save, restore discovery, and deletion.
- Modify `src/lib/share.ts`: v2 calculator-aware fragments plus backward-compatible v1 Home decoding.
- Modify `src/lib/exports.ts`: calculator-aware filenames, assumptions, summaries, schedules, and typed XLSX cells.
- Add and update focused tests in `src/lib`.

### React UI

- Create `src/components/CalculatorShell.tsx`: header, preset tabs, solver tools, query selection, privacy status, and layout.
- Create `src/components/CalculatorFields.tsx`: reusable accessible field primitives.
- Create `src/components/GuidedSection.tsx`: progressive step disclosure and configured-state summary.
- Create `src/components/ResultSummary.tsx`: normalized result rendering and actions.
- Create `src/components/PaymentGraph.tsx`: accessible responsive SVG and graph controls.
- Create `src/components/calculators/GenericForm.tsx`.
- Create `src/components/calculators/HomeForm.tsx` by moving current Home controls out of `App.tsx`.
- Create `src/components/calculators/CarForm.tsx`.
- Create `src/components/calculators/PersonalForm.tsx`.
- Create `src/components/calculators/EducationForm.tsx`.
- Create `src/components/calculators/SolverForm.tsx`.
- Modify `src/components/Schedule.tsx`: normalized schedules and graph selection linkage.
- Modify `src/components/Charts.tsx`: retain cost composition only; replace the static balance chart with `PaymentGraph`.
- Refactor `src/App.tsx`: per-tab suite state, reset/undo, remember/restore/delete, and boundary orchestration.
- Replace the existing editorial treatment in `src/styles.css` with the approved calm product design system.

### Browser verification

- Create `e2e/calculator-suite.spec.ts`.
- Create `e2e/graph.spec.ts`.
- Create `e2e/privacy-state.spec.ts`.
- Modify existing app, accessibility, sharing, export, and print suites for the suite shell.

---

### Task 1: Extract the reusable amortization engine without changing Home results

**Files:**

- Create: `src/domain/amortization/index.ts`
- Create: `src/domain/amortization/amortization.test.ts`
- Modify: `src/domain/loan/index.ts`
- Test: `src/domain/loan/loan.test.ts`

- [x] **Step 1: Write a failing Home parity test around the extracted contract**

Add to `src/domain/amortization/amortization.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildAmortizationSchedule } from './index'

describe('buildAmortizationSchedule', () => {
  it('matches the audited 40 lakh, 9%, 240-month fixture', () => {
    const result = buildAmortizationSchedule({
      principal: 4_000_000,
      annualRate: 9,
      tenureMonths: 240,
      startDate: '2026-08-01',
      prepayments: [],
      rateChanges: [],
      balloonAmount: 0,
    })

    expect(result.initialEmi).toBe(35_989.04)
    expect(result.rows).toHaveLength(240)
    expect(result.rows.at(-1)?.balance).toBe(0)
    expect(result.rows.reduce((sum, row) => sum + row.interest, 0)).toBe(result.totalInterest)
  })
})
```

- [x] **Step 2: Run the focused test and verify the missing module failure**

Run: `npm test -- --run src/domain/amortization/amortization.test.ts`

Expected: FAIL because `src/domain/amortization/index.ts` does not exist.

- [x] **Step 3: Define the shared contract and move the existing standard schedule logic**

Create `src/domain/amortization/index.ts` with these public types:

```ts
import type { Prepayment, RateChange } from '../loan'

export interface AmortizationInput {
  principal: number
  annualRate: number
  tenureMonths: number
  startDate: string
  prepayments: Prepayment[]
  rateChanges: RateChange[]
  balloonAmount: number
}

export interface AmortizationResult {
  initialEmi: number
  totalInterest: number
  totalPrepayments: number
  payoffDate: string
  rows: AmortizationRow[]
  errors: string[]
  warnings: string[]
}

export interface AmortizationRow {
  month: number
  date: string
  annualRate: number
  emi: number
  principal: number
  interest: number
  prepayment: number
  balance: number
}

export function calculateBalloonEmi(
  principal: number,
  annualRate: number,
  months: number,
  balloonAmount: number,
): number

export function buildAmortizationSchedule(input: AmortizationInput): AmortizationResult
```

Move the current standard schedule loop, cycle indexing, rate-change handling, prepayment recurrence, rounding, and 600-cycle guard from `src/domain/loan/index.ts` into this module. For zero balloon, preserve every posted value. For a positive balloon, use:

```ts
const monthlyRate = annualRate / 100 / 12
const factor = (1 + monthlyRate) ** months
const payment = monthlyRate === 0
  ? (principal - balloonAmount) / months
  : (principal * factor - balloonAmount) * monthlyRate / (factor - 1)
```

The final schedule row must post the contractual balloon and close the balance to zero.

- [x] **Step 4: Adapt Home to the shared engine and run parity coverage**

In `calculateLoan`, call:

```ts
const standardEngine = buildAmortizationSchedule({
  principal: loanAmount,
  annualRate: scenario.annualRate,
  tenureMonths: scenario.tenureMonths,
  startDate: scenario.startDate,
  prepayments: scenario.prepayments,
  rateChanges: scenario.rateChanges,
  balloonAmount: 0,
})
```

Map `standardEngine.rows` back to the existing `CalculationResult.standard.schedule` without changing the public Home result contract.

Run:

```sh
npm test -- --run src/domain/amortization/amortization.test.ts src/domain/loan/loan.test.ts
npm run typecheck
npm run lint
```

Expected: all existing Home golden, OD, recurrence, and fuzz cases PASS.

- [x] **Step 5: Commit the extraction**

```sh
git add src/domain/amortization src/domain/loan/index.ts
git commit -m "refactor: share amortization engine"
```

---

### Task 2: Add suite contracts and the Generic calculator

**Files:**

- Create: `src/domain/calculators/types.ts`
- Create: `src/domain/calculators/generic.ts`
- Create: `src/domain/calculators/generic.test.ts`
- Create: `src/domain/calculators/index.ts`

- [x] **Step 1: Write failing Generic result and dispatch tests**

```ts
import { describe, expect, it } from 'vitest'
import { calculateSuite, defaultSuiteScenario } from './index'

describe('Generic calculator', () => {
  it('calculates a lender-neutral EMI schedule', () => {
    const scenario = defaultSuiteScenario('generic')
    const result = calculateSuite(scenario)

    expect(result.kind).toBe('generic')
    expect(result.view.primary.label).toBe('Monthly EMI')
    expect(result.view.schedule.at(-1)?.balance).toBe(0)
    expect(result.view.errors).toEqual([])
  })
})
```

Run: `npm test -- --run src/domain/calculators/generic.test.ts`

Expected: FAIL because the suite modules do not exist.

- [x] **Step 2: Define discriminated scenario and normalized result types**

Create `src/domain/calculators/types.ts`:

```ts
import type { CalculationResult, LoanScenario, Prepayment, RateChange, ValidationIssue } from '../loan'

export type CalculatorKind = 'generic' | 'home' | 'car' | 'personal' | 'education'
export type SolverKind = 'affordability' | 'prepayment' | 'tenure' | 'interest-rate'

export interface GenericScenario {
  principal: number
  annualRate: number
  tenureMonths: number
  startDate: string
  processingFee: number
  prepayments: Prepayment[]
  rateChanges: RateChange[]
}

export interface ViewMetric {
  id: string
  label: string
  value: number | string
  format: 'currency' | 'percentage' | 'date' | 'number' | 'text'
}

export interface UnifiedScheduleRow {
  period: number
  date: string
  payment: number
  principal: number
  interest: number
  prepayment: number
  costs: number
  balance: number
  odNetUtilized?: number
}

export interface UnifiedViewResult {
  primary: ViewMetric
  metrics: ViewMetric[]
  schedule: UnifiedScheduleRow[]
  issues: ValidationIssue[]
  errors: string[]
  warnings: string[]
}

export type SuiteScenario =
  | { kind: 'generic'; value: GenericScenario }
  | { kind: 'home'; value: LoanScenario }

export type SuiteResult =
  | { kind: 'generic'; scenario: GenericScenario; view: UnifiedViewResult; native: import('./generic').GenericResult }
  | { kind: 'home'; scenario: LoanScenario; view: UnifiedViewResult; native: CalculationResult }
```

Tasks 4, 5, and 6 extend these unions only when the corresponding concrete module exists, so every intermediate commit type-checks.

- [x] **Step 3: Implement Generic defaults, validation, and normalization**

Create `generic.ts` with:

```ts
export interface GenericResult {
  initialEmi: number
  totalInterest: number
  totalRepayment: number
  payoffDate: string
  schedule: UnifiedScheduleRow[]
}

export const defaultGenericScenario = (): GenericScenario => ({
  principal: 1_000_000,
  annualRate: 10,
  tenureMonths: 60,
  startDate: '2026-08-01',
  processingFee: 0,
  prepayments: [],
  rateChanges: [],
})
```

Validate finite principal `> 0 && <= 1_000_000_000`, annual rate `0..50`, tenure `1..480`, a valid date, non-negative fee, unique event IDs, valid event dates, and 100-entry caps. On errors, return an empty schedule. On success, call `buildAmortizationSchedule` and normalize its rows.

- [x] **Step 4: Add switch-based dispatch without a plugin framework**

Create `src/domain/calculators/index.ts`:

```ts
export function defaultSuiteScenario(kind: 'generic' | 'home'): SuiteScenario {
  switch (kind) {
    case 'generic': return { kind, value: defaultGenericScenario() }
    case 'home': return { kind, value: defaultScenario() }
  }
}

export function calculateSuite(scenario: SuiteScenario): SuiteResult {
  switch (scenario.kind) {
    case 'generic': return calculateGeneric(scenario.value)
    case 'home': return calculateHomeAdapter(scenario.value)
  }
}
```

Tasks 4, 5, and 6 add their default and calculation cases after extending `SuiteScenario` and `SuiteResult`; TypeScript must never be committed with missing imports.

- [x] **Step 5: Verify and commit Generic**

Run:

```sh
npm test -- --run src/domain/calculators/generic.test.ts src/domain/loan/loan.test.ts
npm run typecheck
npm run lint
```

Expected: Generic and all Home tests PASS.

```sh
git add src/domain/calculators
git commit -m "feat: add generic loan calculator"
```

---

### Task 3: Implement the four solver tools

**Files:**

- Create: `src/domain/calculators/solvers.ts`
- Create: `src/domain/calculators/solvers.test.ts`

- [x] **Step 1: Add independent solver fixtures**

```ts
import { describe, expect, it } from 'vitest'
import { solveAffordablePrincipal, solveAnnualRate, solveTenureMonths } from './solvers'

describe('loan solvers', () => {
  it('solves principal from EMI', () => {
    expect(solveAffordablePrincipal({ emi: 21_247.04, annualRate: 10, tenureMonths: 60 })).toBeCloseTo(1_000_000, 0)
  })

  it('solves tenure from principal and EMI', () => {
    expect(solveTenureMonths({ principal: 1_000_000, annualRate: 10, emi: 21_247.04 })).toBe(60)
  })

  it('solves the implied annual rate', () => {
    expect(solveAnnualRate({ principal: 1_000_000, emi: 21_247.04, tenureMonths: 60 })).toBeCloseTo(10, 4)
  })
})
```

- [x] **Step 2: Run the test and confirm missing exports**

Run: `npm test -- --run src/domain/calculators/solvers.test.ts`

Expected: FAIL because solver functions are undefined.

- [x] **Step 3: Implement affordability and tenure formulas**

Use these exact boundaries:

```ts
export const solveAffordablePrincipal = ({ emi, annualRate, tenureMonths }: AffordabilityInput) => {
  const rate = annualRate / 100 / 12
  if (rate === 0) return roundMoney(emi * tenureMonths)
  return roundMoney(emi * ((1 + rate) ** tenureMonths - 1) / (rate * (1 + rate) ** tenureMonths))
}

export const solveTenureMonths = ({ principal, annualRate, emi }: TenureInput) => {
  const rate = annualRate / 100 / 12
  if (rate === 0) return Math.ceil(principal / emi)
  if (emi <= principal * rate) throw new Error('EMI must exceed first-month interest.')
  return Math.ceil(-Math.log(1 - principal * rate / emi) / Math.log(1 + rate))
}
```

- [x] **Step 4: Implement bounded implied-rate bisection and prepayment comparison**

`solveAnnualRate` must search `0..50` percent for at most 80 iterations and stop when the EMI error is below ₹0.005. Reject non-finite input and a target EMI outside the zero-rate/50%-rate bounds.

`comparePrepayment` must calculate a baseline and modified `AmortizationResult`, then return interest saved, months saved, original payoff, modified payoff, and both schedules. It must accept both keep-EMI and keep-tenure behavior.

- [x] **Step 5: Verify boundaries and commit**

Add cases for zero rate, unaffordable EMI, no implied-rate solution, exact boundary rates, and one-time/recurring prepayments.

Run: `npm test -- --run src/domain/calculators/solvers.test.ts`

Expected: PASS.

```sh
git add src/domain/calculators/solvers.ts src/domain/calculators/solvers.test.ts
git commit -m "feat: add loan solver tools"
```

---

### Task 4: Add the specialized Car calculator

**Files:**

- Create: `src/domain/calculators/car.ts`
- Create: `src/domain/calculators/car.test.ts`
- Modify: `src/domain/calculators/types.ts`
- Modify: `src/domain/calculators/index.ts`

- [x] **Step 1: Add balloon and ownership-cost fixtures**

```ts
it('keeps resale separate from the contractual balloon', () => {
  const result = calculateCar({
    ...defaultCarScenario(),
    vehiclePrice: 2_000_000,
    downPayment: 400_000,
    registrationFees: 200_000,
    financedInsurance: 50_000,
    balloonAmount: 300_000,
    expectedResaleValue: 700_000,
    ownershipMonths: 60,
  })

  expect(result.financedPrincipal).toBe(1_850_000)
  expect(result.schedule.at(-1)?.payment).toBeGreaterThanOrEqual(300_000)
  expect(result.netOwnershipCost).toBe(result.cashOutflowThroughHorizon - 700_000)
})
```

- [x] **Step 2: Define Car scenario and result types**

```ts
export interface CarScenario {
  vehiclePrice: number
  downPayment: number
  downPaymentMode: 'amount' | 'percent'
  registrationFees: number
  financeRegistrationFees: boolean
  financedInsurance: number
  annualRate: number
  tenureMonths: number
  startDate: string
  processingFee: number
  balloonAmount: number
  expectedResaleValue: number
  ownershipMonths: number
  prepayments: Prepayment[]
  rateChanges: RateChange[]
}

export interface CarResult {
  financedPrincipal: number
  initialEmi: number
  balloonAmount: number
  totalInterest: number
  cashOutflowThroughHorizon: number
  netOwnershipCost: number
  schedule: UnifiedScheduleRow[]
}
```

- [x] **Step 3: Implement defaults, validation, and calculation**

Defaults: ₹10 lakh vehicle, 20% down payment, 10% rate, 60 months, no balloon, resale horizon equal to tenure. Validate balloon `< financed principal`, ownership horizon `1..tenure`, and all money within the supported cap.

Financed principal is:

```ts
const downPaymentAmount = scenario.downPaymentMode === 'percent'
  ? roundMoney(scenario.vehiclePrice * scenario.downPayment / 100)
  : scenario.downPayment
const financedPrincipal = roundMoney(
  scenario.vehiclePrice
  - downPaymentAmount
  + (scenario.financeRegistrationFees ? scenario.registrationFees : 0)
  + scenario.financedInsurance,
)
```

Call `buildAmortizationSchedule` with `balloonAmount`. Compute horizon outflow from down payment, unfinanced fees, processing fee, schedule payments through ownership horizon, and the contractual balloon if it falls in that horizon. Subtract resale only from ownership cost.

- [x] **Step 4: Normalize and dispatch Car**

Map principal, interest, prepayment, fees, and balance into `UnifiedScheduleRow`. Add Car to `defaultSuiteScenario` and `calculateSuite` only after all types and tests compile.

- [x] **Step 5: Verify and commit**

Run:

```sh
npm test -- --run src/domain/calculators/car.test.ts src/domain/amortization/amortization.test.ts
npm run typecheck
npm run lint
```

Expected: PASS.

```sh
git add src/domain/calculators
git commit -m "feat: add car loan calculator"
```

---

### Task 5: Add the specialized Personal Loan calculator

**Files:**

- Create: `src/domain/calculators/personal.ts`
- Create: `src/domain/calculators/personal.test.ts`
- Modify: `src/domain/calculators/types.ts`
- Modify: `src/domain/calculators/index.ts`

- [x] **Step 1: Add net-disbursal, flat-rate, and APR fixtures**

```ts
it('separates requested principal from net amount received', () => {
  const result = calculatePersonal({
    ...defaultPersonalScenario(),
    principal: 500_000,
    processingFee: 2,
    processingFeeMode: 'percent',
    gstRate: 18,
    insuranceDeduction: 2_000,
  })

  expect(result.processingFeeAmount).toBe(10_000)
  expect(result.gstAmount).toBe(1_800)
  expect(result.netDisbursed).toBe(486_200)
  expect(result.effectiveApr).toBeGreaterThan(result.quotedAnnualRate)
})

it('calculates a flat-rate quotation on original principal', () => {
  const result = calculatePersonal({
    ...defaultPersonalScenario(),
    principal: 500_000,
    quotedAnnualRate: 12,
    tenureMonths: 24,
    quotationMode: 'flat',
  })
  expect(result.initialEmi).toBe(25_833.33)
})
```

- [x] **Step 2: Define the Personal scenario/result contract**

```ts
export interface PersonalScenario {
  principal: number
  quotedAnnualRate: number
  quotationMode: 'reducing' | 'flat'
  tenureMonths: number
  startDate: string
  processingFee: number
  processingFeeMode: 'amount' | 'percent'
  gstRate: number
  insuranceDeduction: number
  otherDeduction: number
  prepayments: Prepayment[]
}
```

The result must expose quoted rate, effective APR, net disbursed, each deduction, EMI, total repayment, interest, and normalized schedule.

- [x] **Step 3: Implement reducing and flat schedules**

Reducing mode calls `buildAmortizationSchedule`. Flat mode uses:

```ts
const years = scenario.tenureMonths / 12
const totalInterest = roundMoney(scenario.principal * scenario.quotedAnnualRate / 100 * years)
const initialEmi = roundMoney((scenario.principal + totalInterest) / scenario.tenureMonths)
```

Build a monthly flat schedule that posts equal interest except for the final rounding correction, reduces principal evenly, applies allowed prepayments, and ends at zero.

- [x] **Step 4: Solve effective APR from dated borrower cash flows**

Create cash flow zero as positive `netDisbursed` and monthly payments as negative values. Use bounded bisection on monthly rate `0..50%/12`, stop below ₹0.005 NPV error or after 100 iterations, and return annual nominal APR `monthlyRate * 12 * 100`. Reject a non-positive net disbursal.

- [x] **Step 5: Verify and commit**

Add zero-fee equality, amount/percentage fee, GST, flat/reducing, prepayment, and impossible-net-disbursal cases.

Run: `npm test -- --run src/domain/calculators/personal.test.ts`

Expected: PASS.

```sh
git add src/domain/calculators
git commit -m "feat: add personal loan calculator"
```

---

### Task 6: Add the specialized Education Loan calculator

**Files:**

- Create: `src/domain/calculators/education.ts`
- Create: `src/domain/calculators/education.test.ts`
- Modify: `src/domain/calculators/types.ts`
- Modify: `src/domain/calculators/index.ts`

- [x] **Step 1: Add dated disbursement and capitalization fixtures**

```ts
it('accrues study interest only after each disbursement', () => {
  const scenario = {
    ...defaultEducationScenario(),
    ownContribution: 0,
    disbursements: [
      { id: 'd1', date: '2026-08-01', amount: 500_000 },
      { id: 'd2', date: '2027-08-01', amount: 500_000 },
    ],
    studyAnnualRate: 10,
    studyMonths: 24,
    moratoriumMonths: 6,
    servicingMode: 'none' as const,
  }
  const result = calculateEducation(scenario)
  expect(result.totalDisbursed).toBe(1_000_000)
  expect(result.capitalizedInterest).toBeGreaterThan(0)
  expect(result.repaymentPrincipal).toBe(result.totalDisbursed + result.capitalizedInterest)
})

it('full interest servicing prevents capitalization', () => {
  const result = calculateEducation({ ...defaultEducationScenario(), servicingMode: 'full-interest' })
  expect(result.capitalizedInterest).toBe(0)
})
```

- [x] **Step 2: Define Education phases and list types**

```ts
export interface EducationDisbursement {
  id: string
  date: string
  amount: number
}

export interface EducationScenario {
  courseCost: number
  ownContribution: number
  disbursements: EducationDisbursement[]
  studyAnnualRate: number
  studyMonths: number
  moratoriumMonths: number
  servicingMode: 'none' | 'full-interest' | 'fixed-monthly'
  servicingAmount: number
  repaymentAnnualRate: number
  repaymentTenureMonths: number
  startDate: string
  processingFee: number
  prepayments: Prepayment[]
}
```

Cap disbursements at 100, require unique non-empty IDs, ordered valid dates inside the study/moratorium horizon, total disbursed `<= courseCost - ownContribution`, and supported numeric bounds.

- [x] **Step 3: Implement the chronological study/moratorium ledger**

Loop from the first disbursement epoch day through the repayment-start day. Apply same-day disbursements first, then servicing, then accrue closing-state simple interest:

```ts
const dailyInterest = outstandingPrincipal * (scenario.studyAnnualRate / 100 / 365)
accruedInterest += dailyInterest
```

On each monthly servicing date:

```ts
const service = scenario.servicingMode === 'full-interest'
  ? roundMoney(accruedInterest)
  : scenario.servicingMode === 'fixed-monthly'
    ? Math.min(roundMoney(accruedInterest), scenario.servicingAmount)
    : 0
accruedInterest -= service
servicedInterest += service
```

At repayment start, capitalize `roundMoney(accruedInterest)` exactly once.

- [x] **Step 4: Build repayment schedule and phase rows**

Call `buildAmortizationSchedule` with `totalDisbursed + capitalizedInterest`. Normalize study/moratorium rows with payment, interest serviced, disbursement, accrued interest, and phase label; normalize repayment rows with principal, interest, payment, prepayment, and balance.

- [x] **Step 5: Verify leap years, boundaries, and commit**

Add leap-year Actual/365, partial servicing, 100/101 disbursement limits, duplicate IDs, over-disbursement, zero capitalization, repayment prepayment, and final reconciliation tests.

Run:

```sh
npm test -- --run src/domain/calculators/education.test.ts
npm run typecheck
npm run lint
```

Expected: PASS.

```sh
git add src/domain/calculators
git commit -m "feat: add education loan calculator"
```

---

### Task 7: Add calculator-aware sharing and explicit remembered snapshots

**Files:**

- Create: `src/lib/suite-codec.ts`
- Create: `src/lib/suite-codec.test.ts`
- Create: `src/lib/remembered-scenario.ts`
- Create: `src/lib/remembered-scenario.test.ts`
- Modify: `src/lib/share.ts`
- Modify: `src/lib/share.test.ts`

- [x] **Step 1: Add v2 round-trip and malicious-data tests**

```ts
it.each(['generic', 'home', 'car', 'personal', 'education'] as const)(
  'round-trips a %s scenario through v2',
  (kind) => {
    const scenario = defaultSuiteScenario(kind)
    expect(decodeSuiteScenario(`#v2=${encodeSuiteScenario(scenario).split('=')[1]}`)).toEqual(scenario)
  },
)

it('rejects malformed remembered data atomically', () => {
  expect(parseRememberedSnapshot('{"version":2,"scenario":{"kind":"education","value":{"disbursements":[null]}}}')).toBeNull()
})
```

- [x] **Step 2: Implement one declared-field parser per scenario**

`suite-codec.ts` must expose:

```ts
export const SUITE_VERSION = 2
export function serializeSuiteScenario(scenario: SuiteScenario): string
export function parseSuiteScenario(value: unknown): SuiteScenario
export function parseSuiteScenarioJson(json: string): SuiteScenario | null
```

Reuse dependency-free `isRecord`, finite-number, string, Boolean, enum, and capped-list readers. Do not spread untrusted objects. Reject wrong calculator kinds, invalid nested types, non-finite values, duplicate IDs, blank IDs, and lists above 100.

- [x] **Step 3: Preserve v1 Home links and add v2 fragments**

`decodeScenario` becomes `decodeSharedScenario` returning `SuiteScenario | null`. If the fragment starts `v1=`, call the existing Home parser and wrap `{ kind: 'home', value }`. New shares always write `v2=` and include calculator kind.

`scenarioUrl` must preserve the Pages base and set `?calculator=<kind>` before adding the fragment.

- [x] **Step 4: Implement explicit local remember/restore/delete**

Create `remembered-scenario.ts`:

```ts
export const REMEMBERED_KEY = 'loan-ledger:remembered-scenario:v2'

export const saveRememberedScenario = (scenario: SuiteScenario): boolean => {
  try {
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ version: 2, scenario }))
    return true
  } catch {
    return false
  }
}

export const readRememberedScenario = (): SuiteScenario | null => {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY)
    return raw ? parseRememberedSnapshot(raw) : null
  } catch {
    return null
  }
}

export const deleteRememberedScenario = (): boolean => {
  try {
    localStorage.removeItem(REMEMBERED_KEY)
    return true
  } catch {
    return false
  }
}
```

Do not register a `storage` listener and do not auto-apply `readRememberedScenario()`.

- [x] **Step 5: Verify boundaries and commit**

Test all calculator kinds, v1 compatibility, unknown keys, malformed JSON/base64, 8,000-character fragment limit, localStorage exceptions, explicit delete, and no automatic restore.

Run: `npm test -- --run src/lib/suite-codec.test.ts src/lib/remembered-scenario.test.ts src/lib/share.test.ts`

Expected: PASS.

```sh
git add src/lib/suite-codec* src/lib/remembered-scenario* src/lib/share*
git commit -m "feat: share and remember suite scenarios"
```

---

### Task 8: Refactor App state for calculator navigation, reset, and undo

**Files:**

- Create: `src/lib/suite-state.ts`
- Create: `src/lib/suite-state.test.ts`
- Modify: `src/App.tsx`

- [x] **Step 1: Add pure state-transition tests**

```ts
it('resets the active calculator without deleting remembered data', () => {
  const current = createSuiteModel({ kind: 'car', value: { ...defaultCarScenario(), vehiclePrice: 2_000_000 } })
  const reset = reduceSuiteModel(current, { type: 'reset', now: 1_000 })
  expect(reset.scenario).toEqual(defaultSuiteScenario('car'))
  expect(reset.undo?.scenario).toEqual(current.scenario)
})

it('keeps two models independent', () => {
  const first = createSuiteModel(defaultSuiteScenario('generic'))
  const second = createSuiteModel(defaultSuiteScenario('home'))
  const changed = reduceSuiteModel(first, { type: 'select-kind', kind: 'education' })
  expect(second.scenario.kind).toBe('home')
  expect(changed.scenario.kind).toBe('education')
})
```

- [x] **Step 2: Define the state model and reducer**

```ts
export interface GraphState {
  granularity: 'yearly' | 'monthly'
  hiddenSeries: string[]
  rangeStart: number
  rangeEnd: number
  compareOd: boolean
  selectedPeriod: string | null
}

export interface SuiteModel {
  scenario: SuiteScenario
  currentResult: SuiteResult
  lastValidResult: SuiteResult
  shared: boolean
  graph: GraphState
  undo: { scenario: SuiteScenario; graph: GraphState; expiresAt: number } | null
}
```

Actions: `set-scenario`, `select-kind`, `restore`, `reset`, `undo-reset`, `expire-undo`, `set-graph`, and `clear-shared`. Every scenario transition calls `calculateSuite` once before constructing the next state.

- [x] **Step 3: Parse calculator query and shared fragment once at startup**

Use `new URL(window.location.href).searchParams.get('calculator')`. A valid v2/v1 share wins over the query kind. Otherwise select the valid query kind or `generic` as the product default.

- [x] **Step 4: Add reset undo expiration and query updates**

Reset stores the previous scenario/graph for 10 seconds. An effect schedules `expire-undo`; cleanup cancels the timer. Calculator selection uses `history.replaceState` to update only `?calculator=` and clears a stale share fragment. No route library is added.

- [x] **Step 5: Verify and commit state refactor**

Run:

```sh
npm test -- --run src/lib/suite-state.test.ts
npm run typecheck
npm run lint
```

Expected: PASS with one calculation per state transition.

```sh
git add src/lib/suite-state* src/App.tsx
git commit -m "refactor: manage calculator suite state"
```

---

### Task 9: Build the calm suite shell and visual design system

**Files:**

- Create: `src/components/CalculatorShell.tsx`
- Create: `src/components/CalculatorFields.tsx`
- Create: `src/components/GuidedSection.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `e2e/accessibility.spec.ts`

- [x] **Step 1: Add failing shell accessibility and responsive tests**

```ts
test('shows calculator tabs, solver tools, and private-device status', async ({ page }) => {
  await page.goto('./?calculator=home')
  await expect(page.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Affordability' })).toBeVisible()
  await expect(page.getByText('Calculated privately on this device')).toBeVisible()
})
```

Extend the 320, 375, 430, and landscape checks to assert no document overflow and 44 px targets after the new shell renders.

- [x] **Step 2: Create shared accessible field and disclosure components**

Move `NumberField`, `DateField`, `SelectField`, `ModeToggle`, and `Switch` from `App.tsx` into `CalculatorFields.tsx` without changing IDs, labels, errors, `aria-describedby`, or `aria-invalid` behavior.

`GuidedSection` accepts `step`, `title`, `description`, `optional`, `configured`, `open`, and `onToggle`. Its summary must announce expanded state through native `<details>` semantics and display “Optional” or “Configured” text, not color alone.

- [x] **Step 3: Build the suite shell**

`CalculatorShell` renders one `h1`, an accessible `role="tablist"`, five tab buttons, four solver buttons, the privacy status, guided-form slot, result slot, graph slot, and schedule slot. Arrow keys move between calculator tabs; Enter/Space selects.

- [x] **Step 4: Replace the editorial CSS with approved tokens**

Start `src/styles.css` with:

```css
:root {
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #163337;
  background: #f4f7f7;
  --bg: #f4f7f7;
  --surface: #ffffff;
  --surface-muted: #edf3f3;
  --ink: #163337;
  --muted: #5e7478;
  --line: #cbd8da;
  --accent: #0d675f;
  --accent-hover: #09574f;
  --accent-soft: #dcefeb;
  --danger: #a82d35;
  --warning: #8a5a00;
  --focus: #b65324;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --ease-out: cubic-bezier(.16, 1, .3, 1);
}
```

Remove `.paper-grid`, oversized serif hero rules, repeated eyebrow styling, decorative side stripes, and remote-font assumptions. Use fixed product typography, tabular numeric figures, 4/8 px spacing, bounded shadows, and `prefers-reduced-motion` overrides.

- [x] **Step 5: Run visual shell checks and commit**

Run:

```sh
npm run build
npx playwright test e2e/accessibility.spec.ts --project=chromium --project=webkit
```

Expected: all shell/accessibility tests PASS; initial JS+CSS remains below 85 kB gzip.

```sh
git add src/components/CalculatorShell.tsx src/components/CalculatorFields.tsx src/components/GuidedSection.tsx src/App.tsx src/styles.css e2e/accessibility.spec.ts
git commit -m "feat: add guided calculator shell"
```

---

### Task 10: Add calculator-specific guided forms

**Files:**

- Create: `src/components/calculators/GenericForm.tsx`
- Create: `src/components/calculators/HomeForm.tsx`
- Create: `src/components/calculators/CarForm.tsx`
- Create: `src/components/calculators/PersonalForm.tsx`
- Create: `src/components/calculators/EducationForm.tsx`
- Create: `src/components/calculators/SolverForm.tsx`
- Modify: `src/App.tsx`
- Create: `e2e/calculator-suite.spec.ts`

- [x] **Step 1: Add browser tests for all calculator forms**

Create table-driven tests that select each preset and assert its unique fields:

```ts
for (const [tab, field] of [
  ['Generic', 'Loan principal'],
  ['Home', 'Home value'],
  ['Car', 'Vehicle price'],
  ['Personal', 'Requested loan amount'],
  ['Education', 'Course cost'],
] as const) {
  test(`${tab} exposes its specialized inputs`, async ({ page }) => {
    await page.goto('./')
    await page.getByRole('tab', { name: tab }).click()
    await expect(page.getByLabel(field)).toBeVisible()
  })
}
```

- [x] **Step 2: Move Home fields without changing IDs or calculations**

`HomeForm` receives `scenario`, `result`, `issueFor`, and `onChange`. Move all existing essential, ownership, prepayment, rate-change, OD, and transaction controls from `App.tsx`. Keep dynamic IDs and exact 100-entry caps.

- [x] **Step 3: Implement Generic, Car, and Personal guided forms**

Use shared fields and `GuidedSection`. Essential fields open by default; fees, prepayments, rate changes, balloon/resale, and deductions are optional sections. Every mode selector has `aria-pressed`, labelled bases, and field-keyed errors.

- [x] **Step 4: Implement Education and solver forms**

Education has separate Study funding, Moratorium servicing, and Repayment sections. Dated disbursement rows use stable IDs and a 100-row cap. `SolverForm` switches among four solver-specific inputs and presents impossible-scenario errors inline.

- [x] **Step 5: Verify and commit forms**

Run:

```sh
npm run typecheck
npm run lint
npx playwright test e2e/calculator-suite.spec.ts --project=chromium
```

Expected: every calculator and solver flow PASS with no console/page errors.

```sh
git add src/components/calculators src/App.tsx e2e/calculator-suite.spec.ts
git commit -m "feat: add specialized calculator forms"
```

---

### Task 11: Normalize result summaries and calculator-aware exports

**Files:**

- Create: `src/components/ResultSummary.tsx`
- Modify: `src/lib/exports.ts`
- Modify: `src/lib/exports.test.ts`
- Modify: `src/App.tsx`
- Modify: `e2e/exports.spec.ts`

- [x] **Step 1: Add typed export contracts for each calculator**

For every kind, build and reopen a workbook. Assert native Date, number, percentage, integer, Boolean, formula, and text cells plus calculator-specific assumptions. Assert filenames contain the calculator kind.

```ts
it.each(['generic', 'home', 'car', 'personal', 'education'] as const)(
  'exports typed %s workbook data',
  async (kind) => {
    const result = calculateSuite(defaultSuiteScenario(kind))
    const workbook = await buildSuiteWorkbook(result)
    const buffer = await workbook.xlsx.writeBuffer()
    const reopened = new Workbook()
    await reopened.xlsx.load(buffer)
    expect(reopened.getWorksheet('Assumptions')?.getCell('B2').value).not.toBeNull()
    expect(typeof reopened.getWorksheet('Monthly Schedule')?.getCell('D2').value).toBe('number')
  },
)
```

- [x] **Step 2: Build `ResultSummary` from normalized metrics**

Render `view.primary`, `view.metrics`, calculator-specific comparison blocks, validity status, Undo reset, Remember, Restore, Delete saved scenario, Share, Print, CSV, and XLSX. Use the current result for validity and last valid result only for visibly labelled estimates.

- [x] **Step 3: Generalize CSV and XLSX exports**

Rename APIs to `createSuiteCsv`, `buildSuiteWorkbook`, `downloadSuiteCsv`, and `downloadSuiteXlsx`. Use normalized schedule columns for every calculator, then add kind-specific sheets:

- Home: existing Comparison Summary and OD Transactions;
- Car: Balloon and Ownership Summary;
- Personal: Deductions and APR Summary;
- Education: Disbursements and Phase Summary.

Keep ExcelJS lazy-loaded and preserve delayed object-URL revocation.

- [x] **Step 4: Update browser downloads and print**

Test non-empty calculator-specific CSV/XLSX downloads and print preparation for Home and one non-Home preset. Ensure invalid current input disables all actions.

- [x] **Step 5: Verify and commit**

Run:

```sh
npm test -- --run src/lib/exports.test.ts
npx playwright test e2e/exports.spec.ts --project=chromium
npm run build
```

Expected: PASS; ExcelJS remains a separate lazy chunk.

```sh
git add src/components/ResultSummary.tsx src/lib/exports* src/App.tsx e2e/exports.spec.ts
git commit -m "feat: export calculator suite results"
```

---

### Task 12: Build graph aggregation and the responsive SVG

**Files:**

- Create: `src/domain/calculators/graph.ts`
- Create: `src/domain/calculators/graph.test.ts`
- Create: `src/components/PaymentGraph.tsx`
- Modify: `src/components/Charts.tsx`
- Create: `e2e/graph.spec.ts`

- [x] **Step 1: Add graph aggregation reconciliation tests**

```ts
it('aggregates yearly bars without changing totals', () => {
  const result = calculateSuite(defaultSuiteScenario('home'))
  const yearly = aggregateGraphPeriods(result.view.schedule, 'yearly')
  expect(roundMoney(yearly.reduce((sum, row) => sum + row.principal, 0))).toBe(
    roundMoney(result.view.schedule.reduce((sum, row) => sum + row.principal, 0)),
  )
  expect(roundMoney(yearly.reduce((sum, row) => sum + row.interest, 0))).toBe(
    roundMoney(result.view.schedule.reduce((sum, row) => sum + row.interest, 0)),
  )
})
```

- [x] **Step 2: Implement pure monthly/yearly aggregation**

`aggregateGraphPeriods(schedule, granularity)` returns period key/label, principal, prepayment, interest, costs, payment, closing balance, and optional closing OD net utilization. Yearly rows sum flow values and take the final closing balances.

- [x] **Step 3: Render dependency-free accessible SVG**

`PaymentGraph` accepts `result`, `graphState`, `onGraphStateChange`, and `onSelectPeriod`. Use a fixed viewBox and responsive container. Render stacked `<rect>` bars, standard balance `<path>`, optional OD path, axes, and direct series markers. The schedule table remains the equivalent data view.

- [x] **Step 4: Add yearly/monthly and legend controls**

Use labelled buttons with `aria-pressed`. Hidden series are removed from stack math and legend text says “Show” or “Hide.” Do not rely on opacity alone. Add a concise `aria-describedby` summary containing starting balance, final balance, total principal, and total interest.

- [x] **Step 5: Verify and commit graph foundation**

Run:

```sh
npm test -- --run src/domain/calculators/graph.test.ts
npx playwright test e2e/graph.spec.ts --project=chromium
```

Expected: totals reconcile and yearly/monthly controls PASS.

```sh
git add src/domain/calculators/graph* src/components/PaymentGraph.tsx src/components/Charts.tsx e2e/graph.spec.ts
git commit -m "feat: add interactive payment graph"
```

---

### Task 13: Add deep graph interaction and schedule linkage

**Files:**

- Modify: `src/components/PaymentGraph.tsx`
- Modify: `src/components/Schedule.tsx`
- Modify: `e2e/graph.spec.ts`
- Modify: `e2e/accessibility.spec.ts`

- [x] **Step 1: Add failing tooltip, range, OD, and schedule-link tests**

```ts
test('links graph periods and schedule years', async ({ page }) => {
  await page.goto('./?calculator=home')
  await page.getByRole('button', { name: /2030 payment details/i }).focus()
  await expect(page.getByRole('tooltip')).toContainText('2030')
  await page.keyboard.press('Enter')
  await expect(page.locator('.year-list details').filter({ hasText: '2030' })).toHaveAttribute('open', '')
})
```

Add legend keyboard toggling, touch tooltip, range start/end, Escape clear, OD compare, and schedule-to-graph selection cases.

- [x] **Step 2: Implement keyboard, pointer, and tap tooltips**

Each period group receives `tabIndex={0}`, `role="button"`, and a localized `aria-label`. Focus/pointer/tap set one selected period. Escape clears it. Render a single `role="tooltip"` outside the SVG and connect with `aria-describedby`.

- [x] **Step 3: Implement accessible date-range controls**

Use two labelled `input type="range"` controls for first and last visible period. Clamp start `< end`, preserve at least two periods, and update only graph presentation state. Avoid a pointer-only custom brush.

- [x] **Step 4: Link graph and schedule selections**

`Schedule` accepts `selectedPeriod` and `onSelectPeriod`. Store year `<details>` refs by key. When selection changes, open the matching year and call `scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })`. Clicking/focusing a schedule row selects its graph period.

- [x] **Step 5: Verify five interaction paths and commit**

Run:

```sh
npx playwright test e2e/graph.spec.ts --project=chromium --project=webkit
npx playwright test e2e/accessibility.spec.ts --project=chromium
```

Expected: mouse, keyboard, touch emulation, reduced motion, and OD comparison PASS.

```sh
git add src/components/PaymentGraph.tsx src/components/Schedule.tsx e2e/graph.spec.ts e2e/accessibility.spec.ts
git commit -m "feat: link graph and schedule"
```

---

### Task 14: Complete privacy controls, reset, restore, and independent-tab behavior

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/components/ResultSummary.tsx`
- Create: `e2e/privacy-state.spec.ts`
- Modify: `e2e/sharing-errors.spec.ts`

- [x] **Step 1: Add two-context privacy tests**

```ts
test('keeps open tabs independent and restores only on request', async ({ browser }) => {
  const context = await browser.newContext()
  const first = await context.newPage()
  const second = await context.newPage()
  await first.goto('./?calculator=car')
  await second.goto('./?calculator=car')
  await first.getByLabel('Vehicle price').fill('2000000')
  await expect(second.getByLabel('Vehicle price')).not.toHaveValue('2000000')
  await first.getByRole('button', { name: 'Remember this scenario' }).click()
  await second.reload()
  await expect(second.getByRole('button', { name: 'Restore saved scenario' })).toBeVisible()
  await expect(second.getByLabel('Vehicle price')).not.toHaveValue('2000000')
})
```

- [x] **Step 2: Wire explicit remember and restore UI**

Remember writes only on button/toggle confirmation. Startup reads only whether a valid snapshot is available. Restore dispatches `restore` after user activation. No effect watches localStorage and no open tab receives another tab’s changes.

- [x] **Step 3: Wire reset, undo, and delete**

Reset dispatches the pure reset action and announces “Calculator reset. Undo available for 10 seconds.” Undo restores scenario and graph. Delete saved scenario uses `window.confirm('Delete the saved scenario from this device?')`, deletes the snapshot only after confirmation, and leaves current in-memory state unchanged.

- [x] **Step 4: Assert no unexpected network or storage side effects**

In each privacy test, collect requests after initial same-origin JS/CSS load. Calculation, tab changes, graph interactions, remember, restore, reset, sharing, and exports must create no HTTP request. Assert there is no cookie and no `storage` event changes another page.

- [x] **Step 5: Verify and commit privacy behavior**

Run:

```sh
npx playwright test e2e/privacy-state.spec.ts e2e/sharing-errors.spec.ts --project=chromium --project=webkit
```

Expected: PASS with independent tab state and explicit-only restore.

```sh
git add src/App.tsx src/components/ResultSummary.tsx e2e/privacy-state.spec.ts e2e/sharing-errors.spec.ts
git commit -m "feat: add explicit local scenario restore"
```

---

### Task 15: Run the complete calculation and browser regression matrix

**Files:**

- Modify: `src/domain/calculators/*.test.ts`
- Modify: `e2e/app.spec.ts`
- Modify: `e2e/calculator-suite.spec.ts`
- Modify: `e2e/graph.spec.ts`
- Modify: `e2e/privacy-state.spec.ts`
- Modify: `e2e/accessibility.spec.ts`
- Modify: `e2e/exports.spec.ts`

- [x] **Step 1: Add deterministic calculator invariants**

Run 1,000 fixed-seed valid scenarios per calculator where practical. For every error-free amortizing result assert non-negative balances, final zero balance, principal reconciliation, interest reconciliation, finite totals, monotonic contractual balance absent new disbursement, and schedule length guards. Education additionally reconciles disbursements, serviced interest, capitalization, and repayment principal.

- [x] **Step 2: Add a full browser journey per calculator**

Each journey changes specialized inputs, verifies headline and graph changes, expands a schedule year, shares into a new context, downloads CSV/XLSX, prepares print, resets, and confirms defaults. Use stable labels and values, not screenshots as assertions.

- [x] **Step 3: Run unit tests twice**

Run:

```sh
npm test
npm test
```

Expected: both runs PASS with identical test counts and no timing flake.

- [x] **Step 4: Run the five-project browser matrix at root and Pages subpath**

```sh
npm run build
npm run test:e2e
env VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL=https://owner.github.io/loan_emi_calculator/ npm run build
env VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL=https://owner.github.io/loan_emi_calculator/ npm run test:e2e
```

Expected: Chromium, Firefox, WebKit, Pixel 5, and iPhone 13 projects PASS in both deployments with no console/page errors or cross-origin runtime resources.

- [x] **Step 5: Commit final regression coverage**

```sh
git add src/domain/calculators e2e
git commit -m "test: cover calculator suite journeys"
```

---

### Task 16: Final visual, performance, security, and documentation audit

**Files:**

- Modify: `README.md`
- Modify: `AI_CONTEXT.md`
- Modify: `docs/2026-07-11-hardening-audit.md`
- Modify: `loan_emi_calculator-threat-model.md`
- Review: all files changed by Tasks 1–15

- [x] **Step 1: Run the clean pinned-toolchain gate**

From an exact `git archive` under Node 24.18.0/npm 11.16.0:

```sh
npm ci --ignore-scripts
npm run verify
npm run test:e2e
npm audit --omit=dev
git diff --check
```

Expected: all commands exit 0 and production audit reports 0 vulnerabilities.

- [x] **Step 2: Measure bundle, DOM, and calculations**

Record initial JS/CSS gzip, lazy ExcelJS gzip, initial DOM nodes, default calculation median, supported-maximum Home/OD median, and representative Car/Personal/Education medians. Initial JS+CSS must remain below 85 kB, initial DOM below 1,000 nodes, every calculation below the existing 100 ms guard, and no calculator edit may calculate twice.

- [x] **Step 3: Perform visual inspection at approved viewports**

Capture and inspect 1440×900, 1024×768, 430×932, 375×812, 320×568, and 812×375 for every calculator shell plus Home OD, invalid input, remembered snapshot prompt, graph tooltip/range/OD comparison, schedule selection, focus, reduced motion, and print media. Record physical-device, real screen-reader, and OS print-dialog limitations explicitly.

- [x] **Step 4: Re-run security and privacy review**

Scan source/workflows for raw HTML, `eval`, remote scripts/fonts, credentials, runtime network APIs, cookies, service workers, broad permissions, storage listeners, and unsafe parsing. Confirm all external snapshots use declared-field parsing, all actions remain immutable in CI, and runtime calculation/share/export/remember flows make no network request.

- [x] **Step 5: Update durable documentation and commit evidence**

Document calculator formulas, solver boundaries, graph interactions, reset/undo, remember/restore/delete semantics, independent tabs, exports, commands, deployment, and residual limitations.

```sh
git add README.md AI_CONTEXT.md docs/2026-07-11-hardening-audit.md loan_emi_calculator-threat-model.md
git commit -m "docs: record calculator suite guarantees"
```

---

## Completion checklist

- [x] Generic, Home, Car, Personal, and Education calculators are available from accessible preset tabs.
- [x] Affordability, Prepayment, Tenure, and Interest Rate solvers are available without a router dependency.
- [x] Home/OD golden outputs remain unchanged for equivalent inputs.
- [x] Specialized Car, Personal, and Education formulas have independent golden fixtures and reconciliation tests.
- [x] Every tab owns independent in-memory state; remembered data is off by default and restored only by explicit action.
- [x] Reset supports undo and does not delete remembered data; deletion is a separate confirmed action.
- [x] Share links are calculator-aware, v1 Home links remain readable, and malformed data is rejected atomically.
- [x] The interactive graph supports tooltips, series toggles, range focus, yearly/monthly views, OD comparison, and two-way schedule linkage.
- [x] Graph values, schedules, CSV, typed XLSX, and print outputs reconcile.
- [x] Calm teal product styling replaces the oversized editorial hero and decorative grid while preserving accessibility.
- [x] Root and GitHub Pages subpath matrices pass in five browser projects.
- [x] Bundle, DOM, calculation, dependency-audit, and security budgets pass.
