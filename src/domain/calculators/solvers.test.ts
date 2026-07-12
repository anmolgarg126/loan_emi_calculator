import { describe, expect, it } from 'vitest'
import { addMonths, calculateEmi, roundMoney, type Prepayment } from '../loan'
import { defaultGenericScenario } from './generic'
import type { GenericScenario } from './types'
import {
  comparePrepayment,
  solveAffordablePrincipal,
  solveAnnualRate,
  solveTenureMonths,
} from './solvers'

describe('loan solvers', () => {
  it('solves affordable principal from EMI', () => {
    expect(solveAffordablePrincipal({ emi: 21_247.04, annualRate: 10, tenureMonths: 60 }))
      .toBeCloseTo(1_000_000, 0)
  })

  it('solves tenure from principal and EMI', () => {
    expect(solveTenureMonths({ principal: 1_000_000, annualRate: 10, emi: 21_247.04 })).toBe(61)
    expect(solveTenureMonths({ principal: 1_000_000, annualRate: 10, emi: 21_247.033781624876 })).toBe(61)
  })

  it('solves annual rate from principal and EMI', () => {
    expect(solveAnnualRate({ principal: 1_000_000, emi: 21_247.04, tenureMonths: 60 }))
      .toBeCloseTo(10, 4)
  })

  it('handles zero-rate affordability and tenure', () => {
    expect(solveAffordablePrincipal({ emi: 10_000, annualRate: 0, tenureMonths: 12 })).toBe(120_000)
    expect(solveTenureMonths({ principal: 120_001, annualRate: 0, emi: 10_000 })).toBe(13)
  })

  it.each([1e-12, 1e-13])('stays finite and accurate at a near-zero annual rate of %s', (annualRate) => {
    expect(solveAffordablePrincipal({ emi: 1_000, annualRate, tenureMonths: 480 })).toBe(480_000)
    const tenure = solveTenureMonths({ principal: 479_999, annualRate, emi: 1_000 })
    expect(tenure).toBe(480)
    expect(Number.isFinite(tenure)).toBe(true)
  })

  it('rejects invalid affordability inputs and results above the supported principal', () => {
    expect(() => solveAffordablePrincipal({ emi: Number.NaN, annualRate: 10, tenureMonths: 60 })).toThrow('Invalid solver input.')
    expect(() => solveAffordablePrincipal({ emi: 1, annualRate: 51, tenureMonths: 60 })).toThrow('Invalid solver input.')
    expect(() => solveAffordablePrincipal({ emi: 1, annualRate: 10, tenureMonths: 481 })).toThrow('Invalid solver input.')
    expect(() => solveAffordablePrincipal({ emi: 1_000_000_001, annualRate: 0, tenureMonths: 1 })).toThrow('Invalid solver input.')
    expect(solveAffordablePrincipal({ emi: 1_000_000_000, annualRate: 50, tenureMonths: 1 })).toBeLessThan(1_000_000_000)
    expect(() => solveAffordablePrincipal({ emi: 1_000_000_000.01, annualRate: 50, tenureMonths: 1 })).toThrow('Invalid solver input.')
  })

  it('rejects invalid tenure inputs, non-amortizing EMI, and unsupported output tenure', () => {
    expect(() => solveTenureMonths({ principal: Number.POSITIVE_INFINITY, annualRate: 10, emi: 10_000 })).toThrow('Invalid solver input.')
    expect(() => solveTenureMonths({ principal: 1_000_000_001, annualRate: 10, emi: 10_000 })).toThrow('Invalid solver input.')
    expect(() => solveTenureMonths({ principal: 1_000_000, annualRate: 12, emi: 10_000 })).toThrow('EMI must exceed first-month interest.')
    expect(() => solveTenureMonths({ principal: 1_000_000, annualRate: 12, emi: 9_999.99 })).toThrow('EMI must exceed first-month interest.')
    expect(() => solveTenureMonths({ principal: 1_000_000, annualRate: 0, emi: 1_000 })).toThrow('Supported tenure exceeded.')
    expect(solveTenureMonths({ principal: 1_000_000_000, annualRate: 0, emi: 1_000_000_000 })).toBe(1)
    expect(() => solveTenureMonths({ principal: 1_000_000_000, annualRate: 0, emi: 1_000_000_000.01 })).toThrow('Invalid solver input.')
  })

  it('solves the supported annual-rate bounds', () => {
    expect(solveAnnualRate({ principal: 120_000, emi: 10_000, tenureMonths: 12 })).toBe(0)
    expect(solveAnnualRate({ principal: 100, emi: 33.33, tenureMonths: 3 })).toBe(0)
    expect(solveAnnualRate({ principal: 1_000_000, emi: 21_247.044711268278, tenureMonths: 60 })).toBeCloseTo(10, 8)
    expect(solveAnnualRate({ principal: 1_000_000, emi: 45_604.74, tenureMonths: 60 })).toBe(50)
  })

  it('finds a deterministic unique raw-rate solution when cent rounding is ambiguous', () => {
    const input = { principal: 1, emi: 0.01, tenureMonths: 480 }
    const first = solveAnnualRate(input)

    expect(first).toBeCloseTo(11.894546653942378, 8)
    expect(solveAnnualRate(input)).toBe(first)
  })

  it('rejects invalid or unsolvable annual-rate inputs', () => {
    expect(() => solveAnnualRate({ principal: 0, emi: 1, tenureMonths: 12 })).toThrow('Invalid solver input.')
    expect(() => solveAnnualRate({ principal: 120_000, emi: 9_999, tenureMonths: 12 })).toThrow('EMI is outside the supported rate range.')
    expect(() => solveAnnualRate({ principal: 120_000, emi: 100_000, tenureMonths: 12 })).toThrow('EMI is outside the supported rate range.')
    expect(() => solveAnnualRate({ principal: 120_000, emi: 9_999.999, tenureMonths: 12 })).toThrow('EMI is outside the supported rate range.')
    const maximumEmi = calculateEmi(120_000, 50, 12)
    expect(() => solveAnnualRate({ principal: 120_000, emi: maximumEmi + 0.001, tenureMonths: 12 })).toThrow('EMI is outside the supported rate range.')
    expect(solveAnnualRate({ principal: 1_000_000_000, emi: 1_000_000_000, tenureMonths: 1 })).toBe(0)
    expect(() => solveAnnualRate({ principal: 1_000_000_000, emi: 1_000_000_000.01, tenureMonths: 1 })).toThrow('Invalid solver input.')
  })

  it('supports the largest bounded solver inputs', () => {
    const monthlyRate = 50 / 1200
    const factor = (1 + monthlyRate) ** 480
    const emi = 1_000_000_000 * monthlyRate * factor / (factor - 1)
    expect(solveAffordablePrincipal({ emi, annualRate: 50, tenureMonths: 480 })).toBe(1_000_000_000)
    expect(solveTenureMonths({ principal: 1_000_000_000, annualRate: 50, emi: emi + 0.0001 })).toBe(480)
  })
})

const scenario = (): GenericScenario => ({
  ...defaultGenericScenario(),
  principal: 1_000_000,
  annualRate: 10,
  tenureMonths: 60,
  startDate: '2026-01-31',
  prepayments: [],
  rateChanges: [],
})

const prepayment = (patch: Partial<Prepayment> = {}): Prepayment => ({
  id: 'extra',
  date: scenario().startDate,
  amount: 100_000,
  frequency: 'once',
  ...patch,
})

describe('prepayment comparison', () => {
  it('shortens payoff when EMI is preserved', () => {
    const result = comparePrepayment({ scenario: scenario(), prepayments: [prepayment()], mode: 'keep-emi' })

    expect(result.modified.schedule.length).toBeLessThan(result.baseline.schedule.length)
    expect(result.monthsSaved).toBe(result.baseline.schedule.length - result.modified.schedule.length)
    expect(result.modifiedPayoff).toBe(result.modified.payoffDate)
    expect(result.originalPayoff).toBe(result.baseline.payoffDate)
    expect(result.interestSaved).toBeGreaterThan(0)
  })

  it.each([
    ['monthly', [0, 1, 2, 3]],
    ['quarterly', [0, 3, 6, 9]],
  ] as const)('places %s recurring prepayments on their due cycles', (frequency, dueIndexes) => {
    const result = comparePrepayment({
      scenario: scenario(),
      prepayments: [prepayment({ amount: 1_000, frequency })],
      mode: 'keep-tenure',
    })

    expect(dueIndexes.map((index) => result.modified.schedule[index]?.prepayment)).toEqual(dueIndexes.map(() => 1_000))
    if (frequency === 'quarterly') {
      expect([1, 2, 4, 5].map((index) => result.modified.schedule[index]?.prepayment)).toEqual([0, 0, 0, 0])
    }
    expect(result.modified.schedule).toHaveLength(result.baseline.schedule.length)
    expect(result.modified.schedule.at(-1)?.balance).toBe(0)
    expect(result.modifiedPayoff).toBe(result.originalPayoff)
    expect(roundMoney(result.modified.schedule.reduce((sum, row) => sum + row.interest, 0)))
      .toBe(result.modified.totalInterest)
    expect(roundMoney(result.modified.schedule.reduce(
      (sum, row) => sum + row.principal + row.prepayment,
      0,
    ))).toBe(scenario().principal)
  })

  it('recasts later EMI while preserving the contractual payoff', () => {
    const result = comparePrepayment({ scenario: scenario(), prepayments: [prepayment()], mode: 'keep-tenure' })

    expect(result.modified.schedule).toHaveLength(result.baseline.schedule.length)
    expect(result.modifiedPayoff).toBe(result.originalPayoff)
    expect(result.monthsSaved).toBe(0)
    expect(result.modified.schedule[1]!.payment).toBeLessThan(result.baseline.schedule[1]!.payment)
  })

  it.each([
    [12, 64],
    [8, 58],
  ])('keeps a %s%% reset baseline at its actual %s-cycle payoff', (annualRate, payoffCycles) => {
    const base = scenario()
    base.rateChanges = [{
      id: 'baseline-reset',
      date: addMonths(base.startDate, 6),
      annualRate,
      mode: 'keep-emi',
    }]
    const result = comparePrepayment({
      scenario: base,
      prepayments: [prepayment({ date: addMonths(base.startDate, 24), amount: 50_000 })],
      mode: 'keep-tenure',
    })

    expect(result.baseline.schedule).toHaveLength(payoffCycles)
    expect(result.modified.schedule).toHaveLength(payoffCycles)
    expect(result.modified.schedule.slice(0, 24)).toEqual(result.baseline.schedule.slice(0, 24))
    expect(result.baseline.schedule[24]?.prepayment).toBe(0)
    expect(result.modified.schedule[24]?.prepayment).toBe(50_000)
    expect(result.modifiedPayoff).toBe(result.originalPayoff)
    expect(result.modified.schedule.at(-1)?.balance).toBe(0)
    expect(result.interestSaved).toBe(roundMoney(
      result.baseline.totalInterest - result.modified.totalInterest,
    ))
  })

  it('preserves a reset on the prepayment row and recasts on the following cycle', () => {
    const base = scenario()
    const date = addMonths(base.startDate, 6)
    base.rateChanges = [{
      id: 'same-cycle-reset',
      date,
      annualRate: 12,
      mode: 'keep-emi',
    }]
    const result = comparePrepayment({
      scenario: base,
      prepayments: [prepayment({ date, amount: 50_000 })],
      mode: 'keep-tenure',
    })
    const scheduled = ({ payment, principal, interest }: typeof result.modified.schedule[number]) => ({
      payment,
      principal,
      interest,
    })

    expect(scheduled(result.modified.schedule[6]!)).toEqual(scheduled(result.baseline.schedule[6]!))
    expect(result.modified.schedule[6]?.prepayment).toBe(50_000)
    expect(result.modified.schedule[7]?.payment).not.toBe(result.baseline.schedule[7]?.payment)
    expect(result.modified.schedule).toHaveLength(result.baseline.schedule.length)
    expect(result.modifiedPayoff).toBe(result.originalPayoff)
  })

  it('rejects a keep-tenure prepayment that necessarily pays off early', () => {
    expect(() => comparePrepayment({
      scenario: scenario(),
      prepayments: [prepayment({ amount: 999_999 })],
      mode: 'keep-tenure',
    })).toThrow('Cannot preserve baseline payoff.')
  })

  it('rejects invalid, duplicate, excessive, and post-payoff events without partial results', () => {
    const base = scenario()
    expect(() => comparePrepayment({ scenario: base, prepayments: [prepayment({ date: '2026-02-30' })], mode: 'keep-emi' })).toThrow('Invalid prepayment comparison.')
    expect(() => comparePrepayment({ scenario: base, prepayments: [prepayment({ amount: 0 })], mode: 'keep-emi' })).toThrow('Invalid prepayment comparison.')
    expect(() => comparePrepayment({ scenario: base, prepayments: [prepayment(), prepayment()], mode: 'keep-emi' })).toThrow('Invalid prepayment comparison.')
    expect(() => comparePrepayment({ scenario: base, prepayments: Array.from({ length: 101 }, (_, id) => prepayment({ id: String(id) })) , mode: 'keep-emi' })).toThrow('Invalid prepayment comparison.')
    expect(() => comparePrepayment({ scenario: base, prepayments: [prepayment({ date: addMonths(base.startDate, 60) })], mode: 'keep-emi' })).toThrow('Invalid prepayment comparison.')
  })

  it('reconciles totals and is deterministic', () => {
    const input = { scenario: scenario(), prepayments: [prepayment()], mode: 'keep-tenure' as const }
    const first = comparePrepayment(input)
    const second = comparePrepayment(input)
    const interest = (rows: typeof first.modified.schedule) => roundMoney(rows.reduce((sum, row) => sum + row.interest, 0))

    expect(first).toEqual(second)
    expect(interest(first.baseline.schedule)).toBe(roundMoney(first.baseline.totalInterest))
    expect(interest(first.modified.schedule)).toBe(roundMoney(first.modified.totalInterest))
    expect(first.interestSaved).toBe(roundMoney(first.baseline.totalInterest - first.modified.totalInterest))
    expect(first.modified.schedule.at(-1)?.balance).toBe(0)
  })
})
