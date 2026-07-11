# Loan Calculator Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the measured correctness, performance, mobile, security, and durability gaps while preserving the existing lender-neutral calculator and its lightweight static architecture.

**Architecture:** Keep the current React/Vite shell and pure TypeScript financial domain. Replace repeated EMI-date scans with verified constant-time cycle indices, process OD events in one explicit daily ledger, strictly parse shared fragments, calculate once per state transition, and lazily mount schedule rows. Split unprivileged CI verification from privileged Pages deployment and add no runtime dependency.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Playwright, plain CSS, native SVG/browser controls, lazy ExcelJS, GitHub Actions, GitHub Pages, Node 24.18.0, npm 11.16.0.

---

## File map

**Modify:**

- `src/domain/loan/index.ts` — rounding, cycle indexing, typed issues, standard and OD engines, cached currency formatting.
- `src/domain/loan/loan.test.ts` — financial boundaries, event order, fuzzing, and performance regression coverage.
- `src/lib/share.ts` — strict dependency-free fragment normalization.
- `src/lib/share.test.ts` — malformed and adversarial fragment matrix.
- `src/lib/exports.ts` — delayed blob cleanup and enabled transaction metadata.
- `src/lib/exports.test.ts` — serialized CSV/XLSX reconciliation.
- `src/App.tsx` — one calculation per transition, shared-link provenance, field errors, and invalid-action guards.
- `src/components/Schedule.tsx` — render monthly rows only for expanded years.
- `src/styles.css` — touch targets, inline errors, and shared-state notice.
- `e2e/app.spec.ts` — split the monolithic smoke test into focused feature flows.
- `playwright.config.ts` — desktop Chromium/Firefox/WebKit and mobile Chrome/WebKit projects.
- `.github/workflows/deploy.yml` — separate least-privilege build and deploy jobs with immutable actions.
- `package.json`, `package-lock.json` — exact toolchain metadata and verification scripts.
- `README.md`, `AI_CONTEXT.md`, `docs/superpowers/specs/2026-07-11-loan-emi-od-calculator-design.md` — hardened semantics and verification contract.
- `docs/2026-07-11-hardening-audit.md`, `loan_emi_calculator-threat-model.md` — resolution status and residual risks.

**Create:**

- `.nvmrc` — `24.18.0`.
- `.github/dependabot.yml` — monthly npm and GitHub Actions update proposals.
- `e2e/accessibility.spec.ts` — viewport, touch-target, accessible-description, and lazy-DOM assertions.
- `e2e/sharing-errors.spec.ts` — malformed fragments, provenance, invalid actions, and reset.
- `e2e/exports.spec.ts` — non-empty CSV/XLSX and print behavior.

No new source directory, runtime service, or runtime dependency is created.

---

### Task 1: Reliable rounding and constant-time EMI-cycle lookup

**Files:**

- Modify: `src/domain/loan/index.ts:112-229`
- Test: `src/domain/loan/loan.test.ts`

- [ ] **Step 1: Add failing rounding and cycle-index tests**

Add `cycleIndex` to the import list and add:

```ts
it('rounds paise half away from zero', () => {
  expect(roundMoney(10.075)).toBe(10.08)
  expect(roundMoney(-10.075)).toBe(-10.08)
  expect(roundMoney(1.0049)).toBe(1)
  expect(roundMoney(1.005)).toBe(1.01)
})

it('maps only exact month-end EMI dates to cycle indices', () => {
  expect(cycleIndex('2026-01-31', '2026-01-31')).toBe(0)
  expect(cycleIndex('2026-01-31', '2026-02-28')).toBe(1)
  expect(cycleIndex('2026-01-31', '2026-03-31')).toBe(2)
  expect(cycleIndex('2026-01-31', '2026-03-30')).toBeNull()
  expect(cycleIndex('not-a-date', '2026-03-31')).toBeNull()
})
```

- [ ] **Step 2: Run focused tests and verify the rounding failure**

Run: `npm test -- src/domain/loan/loan.test.ts`

Expected: FAIL because `cycleIndex` is missing and `roundMoney(10.075)` is `10.07`.

- [ ] **Step 3: Implement scale-aware paise rounding and direct cycle indexing**

Replace `roundMoney`, `isCycleDate`, and the scan-based `prepaymentDue` with:

```ts
export const roundMoney = (value: number) => {
  if (!Number.isFinite(value)) return value
  const scaled = value * 100
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled))
  const paise = scaled >= 0
    ? Math.floor(scaled + 0.5 + tolerance)
    : Math.ceil(scaled - 0.5 - tolerance)
  return paise / 100
}

export const cycleIndex = (startDate: string, candidate: string): number | null => {
  const startDay = toEpochDay(startDate)
  const candidateDay = toEpochDay(candidate)
  if (!Number.isFinite(startDay) || !Number.isFinite(candidateDay) || candidateDay < startDay) return null
  const start = new Date(startDay * DAY_MS)
  const target = new Date(candidateDay * DAY_MS)
  const index = (target.getUTCFullYear() - start.getUTCFullYear()) * 12
    + target.getUTCMonth() - start.getUTCMonth()
  return index <= MAX_MONTHS && addMonths(startDate, index) === candidate ? index : null
}

const isCycleDate = (startDate: string, candidate: string) => cycleIndex(startDate, candidate) !== null

const prepaymentDue = (
  item: Prepayment,
  paymentCycle: number,
  startCycle: number,
) => {
  const delta = paymentCycle - startCycle
  if (delta < 0) return false
  if (item.frequency === 'once') return delta === 0
  const interval = item.frequency === 'monthly' ? 1 : item.frequency === 'quarterly' ? 3 : 12
  return delta % interval === 0
}
```

In `buildStandardSchedule`, normalize once:

```ts
const prepayments = scenario.prepayments.map((item) => ({
  item,
  startCycle: cycleIndex(scenario.startDate, item.date) ?? Number.POSITIVE_INFINITY,
}))
```

Replace the monthly filter with:

```ts
const paymentCycle = month + 1
const duePrepayment = roundMoney(prepayments
  .filter(({ item, startCycle }) => prepaymentDue(item, paymentCycle, startCycle))
  .reduce((sum, { item }) => sum + item.amount, 0))
```

- [ ] **Step 4: Add and run the supported-maximum recurrence regression test**

```ts
it('keeps 100 recurring prepayments within the calculation budget', () => {
  const base = defaultScenario()
  const scenario = {
    ...base,
    tenureMonths: 480,
    prepayments: Array.from({ length: 100 }, (_, index) => ({
      id: `prepay-${index}`,
      date: addMonths(base.startDate, 1 + index * 4),
      amount: 1,
      frequency: 'yearly' as const,
    })),
  }
  calculateLoan(scenario)
  const started = performance.now()
  const result = calculateLoan(scenario)
  expect(performance.now() - started).toBeLessThan(100)
  expect(result.errors).toEqual([])
  expect(result.standard.schedule.at(-1)?.balance).toBe(0)
})
```

Run: `npm test -- src/domain/loan/loan.test.ts`

Expected: PASS in under one second for the complete test file.

- [ ] **Step 5: Commit**

```sh
git add src/domain/loan/index.ts src/domain/loan/loan.test.ts
git commit -m "perf: index recurring prepayments"
```

---

### Task 2: Typed validation, list limits, and deterministic event identity

**Files:**

- Modify: `src/domain/loan/index.ts:1-110,231-300,489-548`
- Test: `src/domain/loan/loan.test.ts`

- [ ] **Step 1: Add failing validation tests**

```ts
it('rejects duplicate IDs, duplicate rate dates, and excessive optional lists', () => {
  const base = defaultScenario()
  const date = addMonths(base.startDate, 1)
  const result = calculateLoan({
    ...base,
    rateChanges: [
      { id: 'same', date, annualRate: 8, mode: 'keep-emi' },
      { id: 'same', date, annualRate: 9, mode: 'keep-tenure' },
    ],
    prepayments: Array.from({ length: 101 }, (_, index) => ({
      id: `p-${index}`, date, amount: 1, frequency: 'once' as const,
    })),
  })
  expect(result.errors).toContain('Rate-change IDs must be unique.')
  expect(result.errors).toContain(`Only one rate change may apply on ${date}.`)
  expect(result.errors).toContain('Prepayments are limited to 100 entries.')
})

it('returns field-keyed validation issues', () => {
  const result = calculateLoan({ ...defaultScenario(), homeValue: 0, annualRate: 51 })
  expect(result.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: 'homeValue' }),
    expect.objectContaining({ field: 'annualRate' }),
  ]))
})
```

- [ ] **Step 2: Run the tests and verify missing limits/issues**

Run: `npm test -- src/domain/loan/loan.test.ts`

Expected: FAIL because `issues` and the new limits do not exist.

- [ ] **Step 3: Introduce validation issues without removing the existing error strings**

Add:

```ts
export interface ValidationIssue {
  field: string
  message: string
}
```

Add `issues: ValidationIssue[]` to `CalculationResult`. Change `validateScenario` to return issues through one helper:

```ts
const issues: ValidationIssue[] = []
const addIssue = (field: string, message: string) => issues.push({ field, message })
```

Use stable field paths such as `homeValue`, `annualRate`, `tenureMonths`, `startDate`, `rateChanges.<id>.date`, `prepayments.<id>.amount`, `od.premiumRate`, and `od.transactions.<id>.amount`. Require `Number.isFinite` for every numeric rate/money field before range comparisons.

Add this reusable uniqueness check:

```ts
const duplicates = <T>(items: T[], key: (item: T) => string) => {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  items.forEach((item) => {
    const value = key(item)
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  })
  return repeated
}
```

Enforce 100-entry caps on `rateChanges`, `prepayments`, and active OD transactions; unique IDs in every list; and unique rate-change dates. Return issues from validation.

In `calculateLoan`, preserve compatibility:

```ts
const validationIssues = validateScenario(scenario)
const errors = [
  ...validationIssues.map(({ message }) => message),
  ...standard.errors,
  ...postPayoffErrors,
  ...od.errors,
]
```

Return `issues`, appending global engine issues as `{ field: 'scenario', message }` only when no field-specific issue already carries the same message.

- [ ] **Step 4: Stop schedule generation for invalid basic structure**

Before calling either engine, return an empty safe result when validation includes `homeValue`, `annualRate`, `tenureMonths`, or `startDate`. Add this helper and pass the already-computed amount fields:

```ts
const emptyCalculationResult = (
  scenario: LoanScenario,
  issues: ValidationIssue[],
  amounts: Pick<CalculationResult,
    'loanAmount' | 'downPaymentAmount' | 'processingFeeAmount' | 'oneTimeExpensesAmount'
    | 'monthlyOwnershipCost' | 'ownershipCostOverOriginalTenure' | 'upfrontCash'>,
): CalculationResult => ({
  scenario,
  ...amounts,
  standard: {
    initialEmi: 0,
    totalInterest: 0,
    totalPrepayments: 0,
    payoffDate: scenario.startDate,
    schedule: [],
    totalModelledOutflow: 0,
  },
  od: {
    enabled: scenario.od.enabled,
    effectiveInitialRate: 0,
    totalInterest: 0,
    totalFees: 0,
    feeAdjustedSavings: 0,
    contractualPayoffDate: scenario.startDate,
    netDebtFreeDate: null,
    endingParkedSurplus: 0,
    schedule: [],
    totalModelledOutflow: 0,
  },
  warnings: [],
  issues,
  errors: issues.map(({ message }) => message),
})
```

Use:

```ts
const blockingFields = new Set(['homeValue', 'annualRate', 'tenureMonths', 'startDate'])
if (validationIssues.some(({ field }) => blockingFields.has(field))) {
  return emptyCalculationResult(scenario, validationIssues, {
    loanAmount, downPaymentAmount, processingFeeAmount, oneTimeExpensesAmount,
    monthlyOwnershipCost, ownershipCostOverOriginalTenure, upfrontCash,
  })
}
```

- [ ] **Step 5: Run domain tests**

Run: `npm test -- src/domain/loan/loan.test.ts`

Expected: PASS, including existing string-based assertions and new keyed issues.

- [ ] **Step 6: Commit**

```sh
git add src/domain/loan/index.ts src/domain/loan/loan.test.ts
git commit -m "fix: harden scenario validation"
```

---

### Task 3: One exact daily OD ledger and permanent debt-free date

**Files:**

- Modify: `src/domain/loan/index.ts:358-487`
- Test: `src/domain/loan/loan.test.ts`

- [ ] **Step 1: Add failing same-day and permanent-offset fixtures**

```ts
it('attributes EMI-date OD flows to that payment row', () => {
  const base = defaultScenario()
  const firstEmi = addMonths(base.startDate, 1)
  const result = calculateLoan({
    ...base,
    tenureMonths: 12,
    od: {
      ...base.od,
      enabled: true,
      monthlyContribution: 1_000,
      transactionsEnabled: true,
      transactions: [{ id: 'same-day', date: firstEmi, type: 'deposit', amount: 500 }],
    },
  })
  expect(result.od.schedule[0]?.deposit).toBe(1_500)
  expect(result.od.schedule[1]?.deposit).toBe(1_000)
})

it('reports only a permanent net debt-free date', () => {
  const base = defaultScenario()
  const withdrawalDate = addMonths(base.startDate, 2)
  const result = calculateLoan({
    ...base,
    tenureMonths: 24,
    od: {
      ...base.od,
      enabled: true,
      openingSurplus: 4_000_000,
      transactionsEnabled: true,
      transactions: [{ id: 'withdraw', date: withdrawalDate, type: 'withdrawal', amount: 3_000_000 }],
    },
  })
  expect(result.od.netDebtFreeDate).not.toBe(base.startDate)
  expect(toEpochDay(result.od.netDebtFreeDate!)).toBeGreaterThan(toEpochDay(withdrawalDate))
})
```

- [ ] **Step 2: Run tests and verify current attribution/date failures**

Run: `npm test -- src/domain/loan/loan.test.ts`

Expected: FAIL because the deposit is assigned to the next row and the opening date remains reported.

- [ ] **Step 3: Replace the nested monthly/day loop with one chronological loop**

Build these maps once:

```ts
const payments = new Map(standardSchedule.map((row, index) => [toEpochDay(row.date), { row, index }]))
const transactionsByDay = new Map<number, OdTransaction[]>()
transactions.forEach((transaction) => {
  const day = toEpochDay(transaction.date)
  transactionsByDay.set(day, [...(transactionsByDay.get(day) ?? []), transaction])
})
```

Loop from `toEpochDay(scenario.startDate)` through the final payment day inclusive. Maintain only drawing power, parked surplus, accrued interest, active rate, monthly deposits/withdrawals, total fees, last positive-utilization day, errors, warnings, and schedule.

On each day:

```ts
const paymentEvent = payments.get(day)
let postedInterest = 0
let annualFee = 0
let prepayment = 0
let payment = 0
let principalReduction = 0

if (paymentEvent) {
  postedInterest = roundMoney(accruedInterest)
  accruedInterest = 0
  const { row, index } = paymentEvent
  const wasOpen = drawingPower > 0.005
  principalReduction = roundMoney(Math.min(drawingPower, row.principal))
  prepayment = roundMoney(Math.min(Math.max(0, drawingPower - principalReduction), row.prepayment))
  const requiredPayment = roundMoney(postedInterest + principalReduction)
  payment = Math.max(row.emi, requiredPayment)
  parkedSurplus = roundMoney(parkedSurplus + Math.max(0, payment - requiredPayment))
  drawingPower = roundMoney(Math.max(0, drawingPower - principalReduction - prepayment))
  if (drawingPower > 0.005) {
    parkedSurplus = roundMoney(parkedSurplus + scenario.od.monthlyContribution)
    periodDeposits = roundMoney(periodDeposits + scenario.od.monthlyContribution)
  }
  annualFee = (index + 1) % 12 === 0 && wasOpen ? scenario.od.annualFee : 0
  totalFees = roundMoney(totalFees + annualFee)
}
```

Then aggregate same-day deposits before withdrawals, validate, update parked surplus and period totals, compute `netUtilized`, update `lastPositiveDay`, push a row for `paymentEvent`, reset period flow totals, switch `activeRate` to the next standard row rate, and finally accrue current-day interest on the closing state:

```ts
const dayTransactions = transactionsByDay.get(day) ?? []
const dayDeposits = roundMoney(dayTransactions
  .filter(({ type }) => type === 'deposit')
  .reduce((sum, { amount }) => sum + amount, 0))
const dayWithdrawals = roundMoney(dayTransactions
  .filter(({ type }) => type === 'withdrawal')
  .reduce((sum, { amount }) => sum + amount, 0))

parkedSurplus = roundMoney(parkedSurplus + dayDeposits)
periodDeposits = roundMoney(periodDeposits + dayDeposits)
if (dayWithdrawals > parkedSurplus + 0.005) {
  errors.push(`Withdrawal on ${fromEpochDay(day)} exceeds the available parked surplus.`)
  break
}
parkedSurplus = roundMoney(parkedSurplus - dayWithdrawals)
periodWithdrawals = roundMoney(periodWithdrawals + dayWithdrawals)

const netUtilized = roundMoney(Math.max(0, drawingPower - parkedSurplus))
if (netUtilized > 0.005) lastPositiveDay = day

if (paymentEvent) {
  const { row, index } = paymentEvent
  schedule.push({
    month: index + 1,
    date: row.date,
    annualRate: row.annualRate + scenario.od.premiumRate,
    payment,
    principalReduction,
    interest: postedInterest,
    prepayment,
    deposit: periodDeposits,
    withdrawal: periodWithdrawals,
    fee: annualFee + (index === 0 ? scenario.od.setupFee : 0),
    drawingPower,
    parkedSurplus,
    availableWithdrawal: parkedSurplus,
    netUtilized,
  })
  periodDeposits = 0
  periodWithdrawals = 0
  activeRate = (standardSchedule[index + 1]?.annualRate ?? row.annualRate) + scenario.od.premiumRate
}

accruedInterest += netUtilized * (activeRate / 100 / 365)
```

After the loop:

```ts
const endingNetUtilized = Math.max(0, drawingPower - parkedSurplus)
const netDebtFreeDate = endingNetUtilized > 0.005
  ? null
  : lastPositiveDay === null
    ? scenario.startDate
    : fromEpochDay(lastPositiveDay + 1)
```

- [ ] **Step 4: Add exact Actual/365 and event-order reconciliation checks**

Keep the existing leap/non-leap fixtures and add assertions that the first-row interest remains `1_019.18` for ₹100,000 at 12% from 2026-01-01 through 2026-01-31, that same-day deposits precede withdrawals, and that schedule deposits/withdrawals equal the scenario’s active flows plus recurring contributions.

- [ ] **Step 5: Run domain tests**

Run: `npm test -- src/domain/loan/loan.test.ts`

Expected: PASS with identical existing golden EMI/interest results and corrected OD attribution.

- [ ] **Step 6: Commit**

```sh
git add src/domain/loan/index.ts src/domain/loan/loan.test.ts
git commit -m "fix: order daily OD events"
```

---

### Task 4: Strict share-fragment parser and provenance

**Files:**

- Modify: `src/lib/share.ts`
- Test: `src/lib/share.test.ts`

- [ ] **Step 1: Add the adversarial parser matrix**

Add a local test helper that base64url-encodes raw JSON, then cover:

```ts
it.each([
  null,
  [],
  { rateChanges: [null] },
  { prepayments: [{ id: 1 }] },
  { od: 'not-an-object' },
  { od: { transactions: [null] } },
  { annualRate: '9' },
])('rejects malformed shared structure %#', (payload) => {
  expect(decodeScenario(`#v1=${encodeRaw(payload)}`)).toBeNull()
})

it('ignores unknown keys but preserves valid partial v1 values', () => {
  const decoded = decodeScenario(`#v1=${encodeRaw({ annualRate: 8.25, unknown: 'ignored' })}`)
  expect(decoded?.annualRate).toBe(8.25)
  expect(decoded).not.toHaveProperty('unknown')
  expect(decoded?.od.enabled).toBe(false)
})
```

Also test list lengths above 100 and duplicate IDs in every list.

- [ ] **Step 2: Run share tests and verify malformed-member failures**

Run: `npm test -- src/lib/share.test.ts`

Expected: FAIL because malformed array members are currently returned.

- [ ] **Step 3: Implement a declared-field parser**

Add dependency-free guards:

```ts
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const optionalNumber = (record: Record<string, unknown>, key: string, fallback: number) => {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${key}`)
  return value
}

const optionalString = (record: Record<string, unknown>, key: string, fallback: string) => {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string') throw new Error(`Invalid ${key}`)
  return value
}
```

Add these Boolean/enum readers:

```ts
const optionalBoolean = (record: Record<string, unknown>, key: string, fallback: boolean) => {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new Error(`Invalid ${key}`)
  return value
}

const optionalEnum = <T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
) => {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`Invalid ${key}`)
  return value as T
}
```

Build a new `LoanScenario` from defaults and only declared keys. The list parsers return exact declared objects:

```ts
const parseRateChange = (value: unknown): RateChange => {
  if (!isRecord(value)) throw new Error('Invalid rate change')
  return {
    id: optionalString(value, 'id', ''),
    date: optionalString(value, 'date', ''),
    annualRate: optionalNumber(value, 'annualRate', Number.NaN),
    mode: optionalEnum(value, 'mode', ['keep-emi', 'keep-tenure'] as const, 'keep-emi'),
  }
}
```

Implement `parsePrepayment` with `once/monthly/quarterly/yearly` and `parseTransaction` with `deposit/withdrawal` in the same explicit style, cap every array at 100, and reject empty/duplicate IDs. Do not spread decoded objects into trusted state.

- [ ] **Step 4: Run share and domain tests**

Run: `npm test -- src/lib/share.test.ts src/domain/loan/loan.test.ts`

Expected: PASS; malformed fragments return `null` without throwing.

- [ ] **Step 5: Commit**

```sh
git add src/lib/share.ts src/lib/share.test.ts
git commit -m "fix: validate shared scenarios"
```

---

### Task 5: Calculate once, expose inline errors, and mark shared input

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `e2e/sharing-errors.spec.ts`

- [ ] **Step 1: Add failing browser tests for provenance and invalid actions**

Create `e2e/sharing-errors.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('marks a valid shared scenario and clears provenance on reset', async ({ page }) => {
  await page.goto('./#v1=eyJhbm51YWxSYXRlIjo4LjI1fQ')
  await expect(page.getByText(/Loaded from a shared link/)).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByText(/Loaded from a shared link/)).toHaveCount(0)
})

test('recovers from malformed shared state and disables stale actions for invalid input', async ({ page }) => {
  await page.goto('./#v1=eyJyYXRlQ2hhbmdlcyI6W251bGxdfQ')
  await expect(page.getByText(/shared scenario link was invalid/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build your scenario' })).toBeVisible()
  await page.locator('#home-value').fill('0')
  await expect(page.locator('#home-value')).toHaveAttribute('aria-invalid', 'true')
  for (const name of ['Copy share link', 'Print / Save PDF', 'Download CSV', 'Download Excel']) {
    await expect(page.getByRole('button', { name })).toBeDisabled()
  }
})
```

- [ ] **Step 2: Run the new file and verify failures**

Run: `npx playwright test e2e/sharing-errors.spec.ts --project=chromium`

Expected: FAIL because provenance, inline invalid state, and print disabling are missing.

- [ ] **Step 3: Store the current result in model state**

Replace the duplicated calculation flow with:

```ts
const initialScenario = sharedScenario ?? defaultScenario()
const initialResult = calculateLoan(initialScenario)
const [model, setModel] = useState(() => ({
  scenario: initialScenario,
  currentResult: initialResult,
  lastValidResult: initialResult,
  shared: Boolean(sharedScenario),
}))

const calculatedResult = model.currentResult
const result = calculatedResult.errors.length === 0 ? calculatedResult : model.lastValidResult

const setNextScenario = (nextScenario: LoanScenario, shared = false) => setModel((current) => {
  const nextResult = calculateLoan(nextScenario)
  return {
    scenario: nextScenario,
    currentResult: nextResult,
    lastValidResult: nextResult.errors.length === 0 ? nextResult : current.lastValidResult,
    shared,
  }
})
```

Remove the `useMemo` calculation. Reset calls `setNextScenario(defaultScenario())`.

- [ ] **Step 4: Attach field issues to controls**

Extend `NumberField` and `DateField` with `error?: string`. Generate stable IDs `${id}-hint` and `${id}-error`, set `aria-describedby` to present IDs, set `aria-invalid={Boolean(error)}`, and render `<small id={`${id}-error`} className="field-error">{error}</small>`.

Add:

```ts
const issueFor = (field: string) => calculatedResult.issues.find((issue) => issue.field === field)?.message
```

Pass `error={issueFor('homeValue')}`, `error={issueFor('annualRate')}`, and the corresponding stable field path to every scalar and dynamic row control. Keep scenario/global engine messages in the live summary.

- [ ] **Step 5: Add provenance and invalid-action guards**

Render this above results when `model.shared`:

```tsx
<aside className="shared-notice" role="status">
  Loaded from a shared link—verify every input. Anyone with this URL can read its financial values.
</aside>
```

Set `disabled={calculatedResult.errors.length > 0}` on print as well as the existing share/export actions.

- [ ] **Step 6: Run focused browser and unit tests**

Run:

```sh
npm test
npm run build
npx playwright test e2e/sharing-errors.spec.ts --project=chromium
```

Expected: all PASS with no console error.

- [ ] **Step 7: Commit**

```sh
git add src/App.tsx src/styles.css e2e/sharing-errors.spec.ts
git commit -m "fix: surface trusted calculation state"
```

---

### Task 6: Lazy schedule rendering and reliable formatting/downloads

**Files:**

- Modify: `src/domain/loan/index.ts:551-556`
- Modify: `src/components/Schedule.tsx`
- Modify: `src/lib/exports.ts`
- Modify: `src/lib/exports.test.ts`
- Test: `e2e/accessibility.spec.ts`

- [ ] **Step 1: Add formatter and lazy-DOM tests**

In the domain test, verify repeated calls remain stable. Create `e2e/accessibility.spec.ts` with:

```ts
test('mounts monthly rows only for expanded years', async ({ page }) => {
  await page.goto('./')
  const initialNodes = await page.locator('*').count()
  expect(initialNodes).toBeLessThan(1_000)
  const secondYear = page.locator('.year-list details').nth(1)
  await expect(secondYear.locator('tbody tr')).toHaveCount(0)
  await secondYear.locator('summary').click()
  await expect(secondYear.locator('tbody tr')).not.toHaveCount(0)
})
```

- [ ] **Step 2: Cache currency formatters**

Replace per-call construction with:

```ts
const currencyFormatters = new Map<number, Intl.NumberFormat>()

export const formatCurrency = (value: number, maximumFractionDigits = 0) => {
  let formatter = currencyFormatters.get(maximumFractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits,
    })
    currencyFormatters.set(maximumFractionDigits, formatter)
  }
  return formatter.format(Number.isFinite(value) ? value : 0)
}
```

- [ ] **Step 3: Mount each year table on demand**

Import `useMemo` and `useState`, then extract this local `YearSchedule` component in `Schedule.tsx`:

```tsx
function YearSchedule({ group, initiallyOpen }: { group: YearGroup; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const principal = group.rows.reduce((sum, row) => sum + row.standard.principal + row.standard.prepayment, 0)
  const interest = group.rows.reduce((sum, row) => sum + row.standard.interest, 0)
  const odInterest = group.rows.reduce((sum, row) => sum + (row.od?.interest ?? row.standard.interest), 0)
  const balance = group.rows.at(-1)?.standard.balance ?? 0

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="year-label">{group.year}</span>
        <span><small>Principal</small><strong>{formatCurrency(principal)}</strong></span>
        <span><small>Interest</small><strong>{formatCurrency(interest)}</strong></span>
        <span className="od-year-cell"><small>OD interest</small><strong>{formatCurrency(odInterest)}</strong></span>
        <span><small>Closing</small><strong>{formatCurrency(balance)}</strong></span>
      </summary>
      {open && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Payment date</th><th>EMI</th><th>Principal</th><th>Interest</th>
                <th>Prepayment</th><th>Balance</th><th>OD interest</th><th>OD net utilized</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map(({ standard, od }) => (
                <tr key={standard.date}>
                  <td>{new Date(`${standard.date}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</td>
                  <td>{formatCurrency(standard.emi)}</td>
                  <td>{formatCurrency(standard.principal)}</td>
                  <td>{formatCurrency(standard.interest)}</td>
                  <td>{formatCurrency(standard.prepayment)}</td>
                  <td>{formatCurrency(standard.balance)}</td>
                  <td>{formatCurrency(od?.interest ?? standard.interest)}</td>
                  <td>{formatCurrency(od?.netUtilized ?? standard.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}
```

Wrap year grouping in `useMemo(..., [result])` and replace the inline year block with:

```tsx
{groups.map((group, index) => (
  <YearSchedule key={group.year} group={group} initiallyOpen={index === 0} />
))}
```

- [ ] **Step 4: Delay blob revocation and identify enabled transaction rows**

Change:

```ts
anchor.remove()
setTimeout(() => URL.revokeObjectURL(url), 0)
```

Add `Enabled` as a Boolean column to `OD Transactions` and write `result.scenario.od.enabled && result.scenario.od.transactionsEnabled` for each row. Add a test asserting the serialized cell is Boolean and false when stored transactions are disabled.

- [ ] **Step 5: Run tests and production build**

Run:

```sh
npm test
npm run build
npx playwright test e2e/accessibility.spec.ts --project=chromium
```

Expected: PASS; default DOM below 1,000; initial gzip remains below 85 KB.

- [ ] **Step 6: Commit**

```sh
git add src/domain/loan/index.ts src/components/Schedule.tsx src/lib/exports.ts src/lib/exports.test.ts e2e/accessibility.spec.ts
git commit -m "perf: render schedules on demand"
```

---

### Task 7: Mobile targets and complete responsive accessibility checks

**Files:**

- Modify: `src/styles.css`
- Modify: `e2e/accessibility.spec.ts`

- [ ] **Step 1: Extend failing touch-target and overflow tests**

```ts
for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
  { width: 812, height: 375 },
]) {
  test(`fits ${viewport.width}x${viewport.height} with usable targets`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('./')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    const undersized = await page.locator('button, summary, a, input, select').evaluateAll((elements) =>
      elements.filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden'
          && rect.width > 0 && rect.height > 0
          && rect.width < 44 && rect.height < 44
      }).map((element) => element.id || element.textContent?.trim()),
    )
    expect(undersized).toEqual([])
  })
}
```

- [ ] **Step 2: Apply minimum target sizes without changing layout structure**

Add or update:

```css
.text-button, .add-button, .remove-button { min-height: 44px; padding-block: 10px; }
.segmented button { min-width: 44px; min-height: 44px; }
.wordmark { min-height: 44px; }
.switch-control { width: 54px; height: 44px; }
.switch-control span { inset-block: 7px; }
.field-error { min-height: 0; color: var(--danger); font-weight: 700; }
.shared-notice { margin-bottom: 24px; padding: 14px; border-left: 4px solid var(--orange); background: #eee6bd; font-size: 12px; line-height: 1.5; }
```

The test uses the “both dimensions below 44” equivalent-target rule so wide text links with a 44 px parent/label target are not falsely rejected.

- [ ] **Step 3: Run Chromium and WebKit mobile checks**

Run:

```sh
npx playwright install chromium webkit
npx playwright test e2e/accessibility.spec.ts --project=mobile-chrome --project=mobile-webkit
```

Expected: PASS at every viewport with zero overflow and no undersized actionable target.

- [ ] **Step 4: Commit**

```sh
git add src/styles.css e2e/accessibility.spec.ts
git commit -m "fix: enlarge mobile interaction targets"
```

---

### Task 8: Exhaustive domain, sharing, and export regression matrix

**Files:**

- Modify: `src/domain/loan/loan.test.ts`
- Modify: `src/lib/share.test.ts`
- Modify: `src/lib/exports.test.ts`

- [ ] **Step 1: Add boundary tables**

Add table-driven tests for:

```ts
it.each([
  { principal: 120_000, rate: 0, months: 12, emi: 10_000 },
  { principal: 100_000, rate: 12, months: 1, emi: 101_000 },
  { principal: 4_000_000, rate: 9, months: 240, emi: 35_989.04 },
])('matches independent EMI fixture %#', ({ principal, rate, months, emi }) => {
  expect(calculateEmi(principal, rate, months)).toBe(emi)
})
```

Add month-end/leap cycles, maximum rate/tenure, each prepayment frequency, sequential rate resets, early payoff, opening-surplus percentage basis, disabled optional data equality, ownership horizon, fees, and event-after-payoff rejection.

Use these exact fixture boundaries:

| Fixture | Inputs | Assertion |
|---|---|---|
| Month end | start `2026-01-31`, cycle 1/2 | `2026-02-28`, `2026-03-31` |
| Leap month | start `2028-02-01`, 12% OD | first posted interest equals `roundMoney(100_000 * .12 * 29 / 365)` |
| Maximum | ₹100 crore, 50%, 480 months | finite EMI, zero closing balance, no schedule beyond 600 |
| Frequencies | start cycle 1, 24 months | once count 1, monthly 24, quarterly 8, yearly 2 unless payoff truncates |
| Sequential reset | 9% → 10% keep-EMI → 8% keep-tenure | deterministic final schedule; second reset EMI differs from initial |
| Early payoff | first-cycle prepayment equal to remaining principal | one-row schedule, zero balance |
| Opening percent | 25% of ₹40 lakh principal | opening parked surplus ₹10 lakh |
| Disabled data | populated OD/prepayment-free optional OD fields with OD disabled | OD result equals standard and fees/savings zero |
| Post-payoff | OD transaction on contractual payoff date | explicit before-payoff validation error |

- [ ] **Step 2: Add deterministic 1,000-scenario invariant fuzzing**

Move the audited fixed-seed PRNG into the test file and generate 1,000 bounded scenarios. For every error-free result assert:

```ts
expect(result.standard.schedule.at(-1)?.balance).toBe(0)
expect(roundMoney(result.standard.schedule.reduce((sum, row) => sum + row.principal + row.prepayment, 0))).toBeCloseTo(result.loanAmount, 2)
expect(roundMoney(result.standard.schedule.reduce((sum, row) => sum + row.interest, 0))).toBe(result.standard.totalInterest)
expect(roundMoney(result.od.schedule.reduce((sum, row) => sum + row.interest, 0))).toBe(result.od.totalInterest)
result.od.schedule.forEach((row, index, rows) => {
  expect(row.drawingPower).toBeGreaterThanOrEqual(0)
  expect(row.parkedSurplus).toBeGreaterThanOrEqual(0)
  expect(row.netUtilized).toBe(roundMoney(Math.max(0, row.drawingPower - row.parkedSurplus)))
  if (index) expect(row.drawingPower).toBeLessThanOrEqual(rows[index - 1]!.drawingPower)
})
```

- [ ] **Step 3: Reopen and reconcile typed exports**

Assert CSV rows equal schedule rows and numeric values. Serialize/reopen one standard and one OD workbook with:

```ts
expect(csv.trim().split('\n')).toHaveLength(result.standard.schedule.length + 1)
expect(csv).not.toContain('₹')

const buffer = await workbook.xlsx.writeBuffer()
const reopened = new Workbook()
await reopened.xlsx.load(buffer)
expect(reopened.worksheets.map(({ name }) => name)).toEqual([
  'Assumptions', 'Comparison Summary', 'Monthly Amortization', 'Yearly Summary', 'OD Transactions',
])
const monthly = reopened.getWorksheet('Monthly Amortization')!
expect(monthly.getCell('B2').value).toBeInstanceOf(Date)
expect(typeof monthly.getCell('D2').value).toBe('number')
expect(monthly.getCell('D2').numFmt).toContain('₹')
expect(reopened.getWorksheet('Comparison Summary')!.getCell('C5').value).toEqual({
  formula: 'B3-C3-C4', result: result.od.feeAdjustedSavings,
})
expect(typeof reopened.getWorksheet('OD Transactions')!.getCell('D2').value).toBe('boolean')
```

- [ ] **Step 4: Run all unit tests twice**

Run:

```sh
npm test
npm test
```

Expected: both runs PASS with deterministic counts and no timing flake.

- [ ] **Step 5: Commit**

```sh
git add src/domain/loan/loan.test.ts src/lib/share.test.ts src/lib/exports.test.ts
git commit -m "test: cover calculator boundaries"
```

---

### Task 9: Cross-browser feature suites

**Files:**

- Modify: `playwright.config.ts`
- Modify: `e2e/app.spec.ts`
- Modify: `e2e/sharing-errors.spec.ts`
- Modify: `e2e/accessibility.spec.ts`
- Create: `e2e/exports.spec.ts`

- [ ] **Step 1: Configure five explicit browser projects**

Use:

```ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
],
```

Keep one worker locally and in CI for deterministic download/preview behavior.

- [ ] **Step 2: Split feature flows by responsibility**

`app.spec.ts` covers essential inputs, amount/percentage modes, homeowner costs, add/remove and all prepayment frequencies, both rate modes, OD off/on, premium/fees, opening amount/percentage, monthly contribution, dated deposit/withdrawal, charts, schedule, reset, and identical headline results.

Implement the flow with this selector/action matrix:

| Feature | Action | Required assertion |
|---|---|---|
| Home value/rate/tenure/date | Fill `#home-value`, `#interest-rate`, `#tenure`, `#start-date` | Loan amount, EMI, payoff update |
| Down payment | Click its `₹` and `% home` buttons; fill `#down-payment` | Calculated loan amount changes and returns |
| Processing/ownership modes | Expand Homeowner costs; toggle each field’s two unit buttons | Upfront/monthly ownership values change |
| Prepayments | Add four rows, select once/monthly/quarterly/yearly, then remove one | Row count and payoff/schedule respond |
| Rate resets | Add two rows; select keep-EMI and keep-tenure | EMI/tenure outputs change without errors |
| OD switch | Check `#od-enabled` | OD result appears; uncheck removes it and equality returns |
| OD premium/fees | Fill `#od-premium`, `#od-setup-fee`, `#od-annual-fee` | Effective rate and fee totals match inputs |
| Opening surplus | Toggle amount/`% loan`, fill `#opening-surplus` | Parked liquidity and savings update |
| Monthly contribution | Fill `#monthly-surplus` | Schedule deposit and savings update |
| Dated flows | Check `#od-transactions`; add deposit and withdrawal rows | Same-date flow appears in correct schedule row |
| Charts | Inspect both `role=img` containers and text legends | Visible and non-empty |
| Schedule | Open second year | Monthly rows mount; closing values visible |
| Reset | Click Reset | Default ₹50 lakh, 9%, 240 months, OD off restored |

`sharing-errors.spec.ts` covers valid provenance, fragment round-trip in a new context, malformed recovery, inline errors, withdrawal cap, 100-row UI cap, disabled actions, and reset.

`exports.spec.ts` contains:

```ts
test('downloads non-empty CSV and XLSX and prepares print', async ({ page }) => {
  await page.goto('./')
  for (const [name, extension] of [['Download CSV', '.csv'], ['Download Excel', '.xlsx']] as const) {
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain(extension)
    const stream = await download.createReadStream()
    let bytes = 0
    for await (const chunk of stream!) bytes += chunk.length
    expect(bytes).toBeGreaterThan(100)
  }
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printed = 'true' } })
  await page.getByRole('button', { name: 'Print / Save PDF' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-printed', 'true')
})
```

- [ ] **Step 3: Add same-origin and error assertions to every suite**

Use a shared local helper in each file rather than a new abstraction: capture console/page errors, and assert all observed resource URLs begin with `page.url()`’s origin.

- [ ] **Step 4: Build and run the complete matrix**

Run:

```sh
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

Expected: every project PASS; no console/page error; headline scenario values match across engines.

- [ ] **Step 5: Run the exact Pages subpath matrix**

Run:

```sh
VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL=https://owner.github.io/loan_emi_calculator/ npm run build
VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL=https://owner.github.io/loan_emi_calculator/ npm run test:e2e
```

Expected: every project PASS from `/loan_emi_calculator/` with working assets, share links, and downloads.

- [ ] **Step 6: Commit**

```sh
git add playwright.config.ts e2e
git commit -m "test: exercise browser feature matrix"
```

---

### Task 10: Reproducible toolchain and least-privilege deployment

**Files:**

- Create: `.nvmrc`
- Create: `.github/dependabot.yml`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Pin the local build contract**

Create `.nvmrc` containing:

```text
24.18.0
```

Add to `package.json`:

```json
"packageManager": "npm@11.16.0",
"engines": {
  "node": "24.18.x",
  "npm": "11.16.x"
},
"scripts": {
  "verify": "npm run lint && npm run typecheck && npm test && npm run build"
}
```

Retain existing scripts and change direct `@types/react`/`@types/react-dom` ranges to their exact installed versions. Run `npm install --package-lock-only` to update lock metadata.

- [ ] **Step 2: Verify clean install without lifecycle scripts**

Run:

```sh
rm -rf node_modules
npm ci --ignore-scripts
npm run verify
```

Expected: PASS. If the native Vite toolchain cannot run, restore with `npm ci`, leave CI on `npm ci`, and record the exact failure in the hardening audit instead of bypassing it.

- [ ] **Step 3: Split build and deploy permissions**

Replace the workflow with `build` and `deploy` jobs. Workflow-level permissions remain `contents: read`; `deploy` alone adds Pages/OIDC. Pin actions exactly:

```yaml
permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
      - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
        with:
          node-version: 24.18.0
          cache: npm
      - run: npm ci --ignore-scripts
      - run: npm run verify
      - run: npx playwright install --with-deps chromium firefox webkit
      - run: npm run test:e2e
      - uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6
      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5
        with:
          path: dist

  deploy:
    needs: build
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5
```

Keep existing triggers, concurrency, `VITE_BASE_PATH`, and `VITE_SITE_URL`.

- [ ] **Step 4: Add monthly dependency proposals**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: monthly
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    open-pull-requests-limit: 5
```

- [ ] **Step 5: Validate workflow syntax and local parity**

Run:

```sh
npm run verify
npm run test:e2e
npm audit --omit=dev
git diff --check
```

Expected: all PASS and audit reports zero production vulnerabilities.

- [ ] **Step 6: Commit**

```sh
git add .nvmrc .github/dependabot.yml .github/workflows/deploy.yml package.json package-lock.json
git commit -m "ci: isolate Pages deployment"
```

---

### Task 11: Close documentation and security findings

**Files:**

- Modify: `README.md`
- Modify: `AI_CONTEXT.md`
- Modify: `docs/superpowers/specs/2026-07-11-loan-emi-od-calculator-design.md`
- Modify: `docs/2026-07-11-hardening-audit.md`
- Modify: `loan_emi_calculator-threat-model.md`

- [ ] **Step 1: Update authoritative semantics**

Document direct cycle indexing, 100-entry caps for every optional list, strict all-or-nothing fragment parsing, same-date row attribution, symmetric half-up paise posting, and the permanent net debt-free definition in the product design and AI context.

- [ ] **Step 2: Update operational verification**

Add Node/npm requirements, `npm run verify`, the five-browser command, Pages-subpath command, and the distinction between automated emulation and physical-device/manual residual testing to README.

- [ ] **Step 3: Mark audit and threat mitigations with evidence**

For each `COR-*`, `PERF-*`, `UX-*`, and `TM-001` through `TM-005`, add `Resolved` plus the implementing commit/test path. Keep `TM-006` accepted as low residual risk while the site has no privileged runtime action.

- [ ] **Step 4: Scan for ambiguity and stale wording**

Run:

```sh
rg -n "first fully|Net debt-free|600-cycle|checkout@v6|setup-node@v6|Print / Save PDF" README.md AI_CONTEXT.md docs loan_emi_calculator-threat-model.md src
rg -n "TBD|TODO|FIXME|XXX" README.md AI_CONTEXT.md docs loan_emi_calculator-threat-model.md
git diff --check
```

Expected: only the approved permanent debt-free wording, immutable action references, and no placeholders or whitespace errors.

- [ ] **Step 5: Commit**

```sh
git add README.md AI_CONTEXT.md docs loan_emi_calculator-threat-model.md
git commit -m "docs: record hardening guarantees"
```

---

### Task 12: Final completion audit

**Files:**

- Review: all files changed by Tasks 1–11

- [ ] **Step 1: Run every automated gate from a clean install**

```sh
rm -rf node_modules dist test-results playwright-report
npm ci --ignore-scripts
npm run verify
npx playwright install chromium firefox webkit
npm run test:e2e
npm audit --omit=dev
git diff --check
```

Expected: all commands exit 0; no known production vulnerability.

- [ ] **Step 2: Run the Pages-subpath production gate**

```sh
VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL=https://owner.github.io/loan_emi_calculator/ npm run build
VITE_BASE_PATH=/loan_emi_calculator/ VITE_SITE_URL=https://owner.github.io/loan_emi_calculator/ npm run test:e2e
```

Expected: five browser projects pass from the repository subpath.

- [ ] **Step 3: Re-run performance evidence**

Use Node 24.18.0 to run the committed supported-maximum regression fixture 25 times. Record median default, maximum OD, and 100-recurring-prepayment results in `docs/2026-07-11-hardening-audit.md`. Expected medians: `<2 ms`, `<20 ms`, and `<20 ms`; no iteration may exceed the 100 ms guard.

- [ ] **Step 4: Perform visual and mobile inspection**

Use the webapp-testing server helper against the production preview. Capture full-page screenshots at 1440×900, 375×812, 320×568, and 812×375; inspect form hierarchy, expanded OD state, error state, schedule expansion, focus visibility, clipping, and print preview. Record only verified observations; physical-device/screen-reader limitations remain explicit.

- [ ] **Step 5: Run the security-guidance review**

Search changed source and workflow files for raw HTML/eval/remote scripts, credentials, command interpolation, unexpected network calls, and broad job permissions. Confirm the threat-model focus paths and run `npm audit --omit=dev` again.

- [ ] **Step 6: Audit every acceptance criterion**

Create a checklist in the final response mapping each design acceptance criterion to a command, test, file, screenshot, or measured result. Any missing or indirect evidence keeps the task open.

- [ ] **Step 7: Commit final measured evidence if it changed**

```sh
git add docs/2026-07-11-hardening-audit.md
git commit -m "docs: record hardening results"
```

Skip this commit only when Task 12 produces no documentation change.
