# Indian Amount Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all numeric fields replaceable without a persistent zero and give every direct or percentage-based monetary amount Indian grouping plus readable rupee words.

**Architecture:** Add dependency-free pure formatting helpers, then make the shared `NumberField` own only focus/draft/display behavior. Calculator forms remain responsible for percentage bases and pass resolved rupee equivalents explicitly; domain scenarios and calculations stay numeric and unchanged.

**Tech Stack:** React 19, TypeScript 6, plain CSS, Vitest, Playwright.

---

### Task 1: Add Indian amount formatting helpers

**Files:**

- Create: `src/lib/indian-amount.ts`
- Create: `src/lib/indian-amount.test.ts`

- [ ] **Step 1: Write failing formatter, parser, and words tests**

Cover `formatIndianAmountInput(12345678.5) === '1,23,45,678.5'`, comma-tolerant parsing, zero, thousand, lakh, crore, compound crore values, nearest-rupee rounding, and non-finite rejection.

- [ ] **Step 2: Run the focused test and confirm missing exports fail**

Run: `npm test -- --run src/lib/indian-amount.test.ts`

Expected: FAIL because `src/lib/indian-amount.ts` does not exist.

- [ ] **Step 3: Implement pure dependency-free helpers**

Export:

```ts
export const formatIndianAmountInput = (value: number): string
export const parseNumericDraft = (draft: string): number | null
export const formatAmountHelper = (value: number, equivalent?: boolean): string | null
```

The helper returns `₹1,00,000 · One lakh rupees`, prefixes `Equivalent: ` when requested, rounds words to the nearest rupee, and returns `null` for non-finite or negative input.

- [ ] **Step 4: Run focused tests and expect PASS**

Run: `npm test -- --run src/lib/indian-amount.test.ts`

### Task 2: Make the shared number field safely editable

**Files:**

- Modify: `src/components/CalculatorFields.tsx`
- Modify: `src/styles.css`
- Modify: `e2e/calculator-suite.spec.ts`

- [ ] **Step 1: Add failing browser coverage for the reported zero bug**

Open Generic, focus the zero Processing fee, type `343`, and assert `343` rather than `0343`. Open Affordability, replace Monthly EMI with `100000`, blur, and assert `1,00,000` plus `₹1,00,000 · One lakh rupees`.

- [ ] **Step 2: Run focused Chromium tests and confirm failure**

Run: `npx playwright test e2e/calculator-suite.spec.ts --project=chromium`

- [ ] **Step 3: Extend `NumberField` with draft and amount display state**

Add `amountValue?: number` and `equivalentAmount?: boolean`. Direct `₹` fields default `amountValue` to their numeric value. Monetary fields use `type="text"` and `inputMode="decimal"`; other numeric fields retain `type="number"`. On focus select the current value and show raw digits; allow an empty local draft; on blur commit empty as zero, restore malformed drafts, and group monetary display. Include the helper in `aria-describedby`.

- [ ] **Step 4: Style the helper**

Add a compact `.amount-helper` style with readable contrast, tabular numerals, and no layout overflow.

- [ ] **Step 5: Run focused tests and expect PASS**

Run: `npm test -- --run src/lib/indian-amount.test.ts && npx playwright test e2e/calculator-suite.spec.ts --project=chromium`

### Task 3: Supply percentage equivalents from calculator forms

**Files:**

- Modify: `src/components/calculators/HomeForm.tsx`
- Modify: `src/components/calculators/CarForm.tsx`
- Modify: `src/components/calculators/PersonalForm.tsx`
- Modify: `e2e/calculator-suite.spec.ts`

- [ ] **Step 1: Add failing browser assertions for percentage equivalents**

Assert Home down payment `20%` shows `Equivalent: ₹10,00,000 · Ten lakh rupees`, Car down payment uses vehicle price, and Personal percentage processing fee uses requested principal. Assert Annual interest rate has no amount helper.

- [ ] **Step 2: Run focused Chromium tests and confirm failure**

Run: `npx playwright test e2e/calculator-suite.spec.ts --project=chromium`

- [ ] **Step 3: Wire existing financial bases**

Pass resolved `amountValue` and `equivalentAmount` only in percentage mode. Home uses home value, `result.loanAmount`, or OD loan amount exactly as the engine does; Car uses vehicle price; Personal uses requested principal. Direct `₹` fields continue using automatic helpers.

- [ ] **Step 4: Run focused unit and browser tests and expect PASS**

Run: `npm test -- --run && npx playwright test e2e/calculator-suite.spec.ts e2e/app.spec.ts --project=chromium --project=webkit`

### Task 4: Document and release-verify the behavior

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-12-indian-amount-inputs.md`

- [ ] **Step 1: Document input behavior**

Add a concise README note explaining raw editing, Indian grouping on blur, amount words, and percentage rupee equivalents.

- [ ] **Step 2: Run all verification gates**

Run `npm run verify`, `npm run test:e2e`, `npm audit --omit=dev`, and `git diff --check`.

Expected: all unit tests and all browser journeys pass; audit reports zero known vulnerabilities; diff check is clean.

- [ ] **Step 3: Mark this plan complete and commit**

Mark every task checkbox complete and commit the implementation with concise conventional commits.
