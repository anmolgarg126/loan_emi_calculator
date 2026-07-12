import { describe, expect, it } from 'vitest'
import { addMonths, calculateEmi, roundMoney, type Prepayment } from '../loan'
import { defaultGenericScenario } from './generic'
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
    const emiAtFifty = calculateEmi(1_000_000, 50, 60)
    expect(solveAnnualRate({ principal: 1_000_000, emi: emiAtFifty, tenureMonths: 60 })).toBeCloseTo(50, 4)
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

const scenario = () => ({
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
  })

  it('recasts later EMI while preserving the contractual payoff', () => {
    const result = comparePrepayment({ scenario: scenario(), prepayments: [prepayment()], mode: 'keep-tenure' })

    expect(result.modified.schedule).toHaveLength(result.baseline.schedule.length)
    expect(result.modifiedPayoff).toBe(result.originalPayoff)
    expect(result.monthsSaved).toBe(0)
    expect(result.modified.schedule[1]!.payment).toBeLessThan(result.baseline.schedule[1]!.payment)
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
