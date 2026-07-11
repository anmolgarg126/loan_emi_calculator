import { describe, expect, it } from 'vitest'
import {
  addMonths,
  calculateEmi,
  calculateLoan,
  cycleIndex,
  defaultScenario,
  fromEpochDay,
  roundMoney,
  toEpochDay,
  type LoanScenario,
} from './index'

const scenarioWith = (patch: Partial<LoanScenario>): LoanScenario => ({ ...defaultScenario(), ...patch })

describe('loan engine', () => {
  it('rounds fractional paise symmetrically', () => {
    expect(roundMoney(10.075)).toBe(10.08)
    expect(roundMoney(-10.075)).toBe(-10.08)
    expect(roundMoney(1.0049)).toBe(1)
    expect(roundMoney(1.005)).toBe(1.01)
  })

  it('finds exact EMI cycle indexes', () => {
    expect(cycleIndex('2026-01-31', '2026-01-31')).toBe(0)
    expect(cycleIndex('2026-01-31', '2026-02-28')).toBe(1)
    expect(cycleIndex('2026-01-31', '2026-03-31')).toBe(2)
    expect(cycleIndex('2026-01-31', '2026-03-30')).toBeNull()
    expect(cycleIndex('2026-01-31', '2025-12-31')).toBeNull()
    expect(cycleIndex('2026-01-31', addMonths('2026-01-31', 601))).toBeNull()
    expect(cycleIndex('invalid', '2026-01-31')).toBeNull()
    expect(cycleIndex('2026-01-31', 'invalid')).toBeNull()
  })

  it('matches the standard EMI golden case', () => {
    expect(calculateEmi(4_000_000, 9, 240)).toBe(35_989.04)
    const result = calculateLoan(defaultScenario())
    expect(result.loanAmount).toBe(4_000_000)
    expect(result.standard.initialEmi).toBe(35_989.04)
    expect(result.standard.totalInterest).toBeCloseTo(4_637_370, -1)
    expect(result.monthlyOwnershipCost).toBe(3_750)
  })

  it('uses UTC-safe date-only arithmetic', () => {
    expect(fromEpochDay(toEpochDay('2028-02-29'))).toBe('2028-02-29')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('makes disabled OD equal the standard result', () => {
    const result = calculateLoan(defaultScenario())
    expect(result.od.totalInterest).toBe(result.standard.totalInterest)
    expect(result.od.totalFees).toBe(0)
    expect(result.od.feeAdjustedSavings).toBe(0)
  })

  it('reduces daily OD interest with parked surplus', () => {
    const base = defaultScenario()
    const result = calculateLoan({
      ...base,
      tenureMonths: 12,
      od: { ...base.od, enabled: true, openingSurplus: 1_000_000 },
    })
    expect(result.errors).toEqual([])
    expect(result.od.totalInterest).toBeLessThan(result.standard.totalInterest)
    expect(result.od.feeAdjustedSavings).toBeGreaterThan(0)
  })

  it('uses Actual/365 and rounds fractional paise only at monthly posting', () => {
    const base = defaultScenario()
    const result = calculateLoan({
      ...base,
      homeValue: 100_000,
      downPayment: 0,
      downPaymentMode: 'amount',
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2026-01-01',
      od: { ...base.od, enabled: true },
    })
    expect(result.od.schedule[0]?.interest).toBe(1_019.18)
  })

  it('uses 29 actual days across a leap-year February', () => {
    const base = defaultScenario()
    const result = calculateLoan({
      ...base,
      homeValue: 100_000,
      downPayment: 0,
      downPaymentMode: 'amount',
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2028-02-01',
      od: { ...base.od, enabled: true },
    })
    expect(result.od.schedule[0]?.interest).toBe(roundMoney(100_000 * 0.12 * 29 / 365))
  })

  it('charges fewer active days when an arbitrary deposit arrives earlier', () => {
    const base = defaultScenario()
    const makeResult = (date: string) => calculateLoan({
      ...base,
      homeValue: 100_000,
      downPayment: 0,
      downPaymentMode: 'amount',
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2026-01-01',
      od: {
        ...base.od,
        enabled: true,
        transactionsEnabled: true,
        transactions: [{ id: date, date, type: 'deposit', amount: 50_000 }],
      },
    })
    expect(makeResult('2026-01-02').od.schedule[0]!.interest)
      .toBeLessThan(makeResult('2026-01-30').od.schedule[0]!.interest)
  })

  it('credits recurring surplus on EMI dates, not at loan opening', () => {
    const base = defaultScenario()
    const atOpening = calculateLoan({
      ...base,
      tenureMonths: 12,
      od: {
        ...base.od,
        enabled: true,
        monthlyContribution: 1_000,
        transactionsEnabled: true,
        transactions: [{ id: 'opening-withdrawal', date: base.startDate, type: 'withdrawal', amount: 1_000 }],
      },
    })
    expect(atOpening.errors.some((error) => error.includes('exceeds the available parked surplus'))).toBe(true)

    const firstEmi = addMonths(base.startDate, 1)
    const onFirstEmi = calculateLoan({
      ...base,
      tenureMonths: 12,
      od: {
        ...base.od,
        enabled: true,
        monthlyContribution: 1_000,
        transactionsEnabled: true,
        transactions: [{ id: 'emi-withdrawal', date: firstEmi, type: 'withdrawal', amount: 1_000 }],
      },
    })
    expect(onFirstEmi.errors).toEqual([])
  })

  it('nets same-day deposits before validating withdrawals', () => {
    const base = defaultScenario()
    const result = calculateLoan({
      ...base,
      tenureMonths: 12,
      od: {
        ...base.od,
        enabled: true,
        transactionsEnabled: true,
        transactions: [
          { id: 'deposit', date: base.startDate, type: 'deposit', amount: 500 },
          { id: 'withdrawal', date: base.startDate, type: 'withdrawal', amount: 500 },
        ],
      },
    })
    expect(result.errors).toEqual([])
    expect(result.od.schedule[0]?.parkedSurplus).toBe(0)
  })

  it('charges setup and anniversary fees while the OD is open', () => {
    const base = defaultScenario()
    const result = calculateLoan({
      ...base,
      tenureMonths: 24,
      od: { ...base.od, enabled: true, setupFee: 2_000, annualFee: 500 },
    })
    expect(result.od.totalFees).toBe(3_000)
    expect(result.od.schedule[11]?.fee).toBe(500)
    expect(result.od.schedule[23]?.fee).toBe(500)
  })

  it('supports both rate-reset modes', () => {
    const base = defaultScenario()
    const date = addMonths(base.startDate, 12)
    const keepEmi = calculateLoan({
      ...base,
      rateChanges: [{ id: 'rate-1', date, annualRate: 10, mode: 'keep-emi' }],
    })
    const keepTenure = calculateLoan({
      ...base,
      rateChanges: [{ id: 'rate-1', date, annualRate: 10, mode: 'keep-tenure' }],
    })
    expect(keepEmi.standard.schedule.length).toBeGreaterThan(base.tenureMonths)
    expect(keepTenure.standard.schedule.length).toBe(base.tenureMonths)
    expect(keepTenure.standard.schedule[12]?.emi).toBeGreaterThan(keepTenure.standard.initialEmi)
  })

  it('rejects a keep-EMI reset that cannot cover interest', () => {
    const base = defaultScenario()
    const result = calculateLoan({
      ...base,
      annualRate: 1,
      rateChanges: [{ id: 'rate-shock', date: addMonths(base.startDate, 1), annualRate: 50, mode: 'keep-emi' }],
    })
    expect(result.errors.some((error) => error.includes('EMI is insufficient'))).toBe(true)
  })

  it('rejects withdrawals above available surplus', () => {
    const base = defaultScenario()
    const result = calculateLoan({
      ...base,
      od: {
        ...base.od,
        enabled: true,
        transactionsEnabled: true,
        transactions: [{ id: 'tx-1', date: base.startDate, type: 'withdrawal', amount: 100 }],
      },
    })
    expect(result.errors.some((error) => error.includes('exceeds the available parked surplus'))).toBe(true)
  })

  it('caps transactions and warns when parked surplus exceeds drawing power', () => {
    const base = defaultScenario()
    const transactions = Array.from({ length: 101 }, (_, index) => ({
      id: `tx-${index}`,
      date: base.startDate,
      type: 'deposit' as const,
      amount: 1,
    }))
    const capped = calculateLoan({
      ...base,
      tenureMonths: 12,
      od: { ...base.od, enabled: true, transactionsEnabled: true, transactions },
    })
    expect(capped.errors).toContain('OD transactions are limited to 100 entries.')

    const excess = calculateLoan({
      ...base,
      tenureMonths: 12,
      od: { ...base.od, enabled: true, openingSurplus: 5_000_000 },
    })
    expect(excess.warnings.some((warning) => warning.includes('exceeds drawing power'))).toBe(true)
  })

  it('keeps permanent prepayments separate from withdrawable surplus', () => {
    const base = defaultScenario()
    const prepaymentDate = addMonths(base.startDate, 1)
    const result = calculateLoan({
      ...base,
      tenureMonths: 24,
      prepayments: [{ id: 'prepay', date: prepaymentDate, amount: 100_000, frequency: 'once' }],
      od: { ...base.od, enabled: true, openingSurplus: 50_000 },
    })
    expect(result.od.schedule[0]?.prepayment).toBe(100_000)
    expect(result.od.schedule[0]?.parkedSurplus).toBeGreaterThanOrEqual(50_000)
  })

  it('reconciles schedule totals with result totals', () => {
    const base = defaultScenario()
    const result = calculateLoan({
      ...base,
      tenureMonths: 24,
      od: { ...base.od, enabled: true, openingSurplus: 100_000, premiumRate: 0.2 },
    })
    const standardInterest = result.standard.schedule.reduce((sum, row) => sum + row.interest, 0)
    const odInterest = result.od.schedule.reduce((sum, row) => sum + row.interest, 0)
    expect(roundMoney(standardInterest)).toBe(result.standard.totalInterest)
    expect(roundMoney(odInterest)).toBe(result.od.totalInterest)
    expect(result.od.feeAdjustedSavings).toBe(roundMoney(result.standard.totalInterest - result.od.totalInterest - result.od.totalFees))
  })

  it('rejects OD transactions on or after payoff', () => {
    const base = defaultScenario()
    const result = calculateLoan({
      ...base,
      tenureMonths: 12,
      od: {
        ...base.od,
        enabled: true,
        transactionsEnabled: true,
        transactions: [{ id: 'tx-late', date: addMonths(base.startDate, 12), type: 'deposit', amount: 100 }],
      },
    })
    expect(result.errors.some((error) => error.includes('must occur before the calculated payoff date'))).toBe(true)
  })

  it('keeps ownership costs on the original tenure horizon', () => {
    const base = scenarioWith({
      prepayments: [{ id: 'p-1', date: addMonths(defaultScenario().startDate, 1), amount: 2_000_000, frequency: 'once' }],
    })
    const result = calculateLoan(base)
    expect(result.standard.schedule.length).toBeLessThan(base.tenureMonths)
    expect(result.ownershipCostOverOriginalTenure).toBe(result.monthlyOwnershipCost * base.tenureMonths)
  })

  it('calculates the largest recurring-prepayment schedule promptly', () => {
    const base = defaultScenario()
    const scenario = scenarioWith({
      tenureMonths: 480,
      prepayments: Array.from({ length: 100 }, (_, index) => ({
        id: `prepayment-${index}`,
        date: addMonths(base.startDate, 1 + index * 4),
        amount: 1,
        frequency: 'yearly' as const,
      })),
    })
    calculateLoan(scenario)

    const startedAt = performance.now()
    const result = calculateLoan(scenario)
    const elapsed = performance.now() - startedAt

    expect(elapsed).toBeLessThan(100)
    expect(result.errors).toEqual([])
    expect(result.standard.schedule.at(-1)?.balance).toBe(0)
  })
})
