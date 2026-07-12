import { describe, expect, it } from 'vitest'
import { addMonths, calculateLoan, defaultScenario, roundMoney } from '../loan'
import { calculateSuite, defaultSuiteScenario } from './index'
import type { GenericScenario } from './types'

const genericWith = (patch: Partial<GenericScenario>) => ({
  kind: 'generic' as const,
  value: { ...defaultSuiteScenario('generic').value, ...patch },
})

describe('Generic calculator', () => {
  it('calculates the audited lender-neutral EMI schedule', () => {
    const result = calculateSuite(defaultSuiteScenario('generic'))

    expect(result.kind).toBe('generic')
    expect(result.view.primary.label).toBe('Monthly EMI')
    expect(result.view.errors).toEqual([])
    expect(result.view.schedule.length).toBeGreaterThan(0)
    expect(result.view.schedule.at(-1)?.balance).toBe(0)
    expect(result.native.initialEmi).toBe(21_247.04)
    expect(result.native.totalInterest).toBe(274_822.84)
    expect(result.native.totalRepayment).toBe(1_274_822.84)
  })

  it('amortizes a zero-rate loan without interest', () => {
    const result = calculateSuite(genericWith({
      principal: 120_000,
      annualRate: 0,
      tenureMonths: 12,
      startDate: '2026-01-01',
    }))

    expect(result.native.initialEmi).toBe(10_000)
    expect(result.native.totalInterest).toBe(0)
    expect(result.native.totalRepayment).toBe(120_000)
    expect(result.view.schedule).toHaveLength(12)
    expect(result.view.schedule.at(-1)?.balance).toBe(0)
  })

  it.each([
    ['principal', { principal: 0 }],
    ['principal', { principal: Number.NaN }],
    ['annualRate', { annualRate: Number.POSITIVE_INFINITY }],
    ['annualRate', { annualRate: 51 }],
    ['tenureMonths', { tenureMonths: 12.5 }],
    ['tenureMonths', { tenureMonths: 481 }],
    ['startDate', { startDate: '2026-02-30' }],
    ['processingFee', { processingFee: -1 }],
    ['processingFee', { processingFee: Number.NaN }],
  ])('blocks invalid %s input', (field, patch) => {
    const result = calculateSuite(genericWith(patch))

    expect(result.view.issues).toEqual(expect.arrayContaining([expect.objectContaining({ field })]))
    expect(result.view.errors.length).toBeGreaterThan(0)
    expect(result.view.schedule).toEqual([])
    expect(result.native.schedule).toEqual([])
  })

  it('rejects malformed, excessive, duplicate, and off-cycle events', () => {
    const base = defaultSuiteScenario('generic').value
    const date = addMonths(base.startDate, 1)
    const result = calculateSuite(genericWith({
      prepayments: Array.from({ length: 101 }, (_, index) => index === 100
        ? null
        : {
            id: index < 2 ? 'same' : `prepay-${index}`,
            date: index === 1 ? '2026-02-30' : date,
            amount: index === 0 ? Number.NaN : 1,
            frequency: index === 0 ? 'weekly' : 'once',
          }) as unknown as GenericScenario['prepayments'],
      rateChanges: Array.from({ length: 101 }, (_, index) => ({
        id: index < 2 ? 'same-rate' : index === 2 ? '' : `rate-${index}`,
        date: index < 2 ? date : addMonths(base.startDate, index + 1),
        annualRate: index === 0 ? Number.NaN : 9,
        mode: index === 0 ? 'recast' : 'keep-emi',
      })) as GenericScenario['rateChanges'],
    }))

    expect(result.view.errors).toEqual(expect.arrayContaining([
      'Prepayments are limited to 100 entries.',
      'Prepayment IDs must be unique.',
      'Rate changes are limited to 100 entries.',
      'Rate-change IDs must be unique.',
      `Only one rate change may apply on ${date}.`,
    ]))
    expect(result.view.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'prepayments.same.amount' }),
      expect.objectContaining({ field: 'prepayments.same.frequency' }),
      expect.objectContaining({ field: 'prepayments.100' }),
      expect.objectContaining({ field: 'rateChanges.2.id' }),
      expect.objectContaining({ field: 'rateChanges.same-rate.annualRate' }),
      expect.objectContaining({ field: 'rateChanges.same-rate.mode' }),
    ]))
    expect(result.view.schedule).toEqual([])
  })

  it('applies prepayments and both rate-reset modes through the shared engine', () => {
    const base = defaultSuiteScenario('generic').value
    const baseline = calculateSuite({ kind: 'generic', value: base })
    const eventDate = addMonths(base.startDate, 12)
    const prepaid = calculateSuite(genericWith({
      prepayments: [{ id: 'extra', date: eventDate, amount: 100_000, frequency: 'once' }],
    }))
    const keepEmi = calculateSuite(genericWith({
      rateChanges: [{ id: 'lower', date: eventDate, annualRate: 8, mode: 'keep-emi' }],
    }))
    const keepTenure = calculateSuite(genericWith({
      rateChanges: [{ id: 'lower', date: eventDate, annualRate: 8, mode: 'keep-tenure' }],
    }))

    expect(prepaid.native.totalInterest).toBeLessThan(baseline.native.totalInterest)
    expect(prepaid.native.payoffDate < baseline.native.payoffDate).toBe(true)
    expect(keepEmi.native.payoffDate < baseline.native.payoffDate).toBe(true)
    expect(keepTenure.native.payoffDate).toBe(baseline.native.payoffDate)
    expect(keepTenure.view.schedule[12]?.payment).toBeLessThan(baseline.view.schedule[12]!.payment)
  })

  it('normalizes schedule rows and includes the processing fee in repayment', () => {
    const scenario = genericWith({ processingFee: 1_234.56 })
    const result = calculateSuite(scenario)
    const interest = roundMoney(result.view.schedule.reduce((sum, row) => sum + row.interest, 0))

    expect(result.view.schedule.every((row) => row.payment === roundMoney(row.principal + row.interest))).toBe(true)
    expect(result.view.schedule.every((row) => row.costs === 0)).toBe(true)
    expect(result.native.totalInterest).toBe(interest)
    expect(result.native.totalRepayment).toBe(roundMoney(scenario.value.principal + interest + 1_234.56))
    expect(result.native.schedule).toBe(result.view.schedule)
  })

  it('adapts Home without changing its native result or schedule semantics', () => {
    const scenario = defaultScenario()
    const native = calculateLoan(scenario)
    const result = calculateSuite({ kind: 'home', value: scenario })

    expect(result.native).toEqual(native)
    expect(result.view.primary).toMatchObject({ label: 'Standard EMI', value: native.standard.initialEmi })
    expect(result.view.errors).toEqual(native.errors)
    expect(result.view.schedule).toHaveLength(native.standard.schedule.length)
    expect(result.view.schedule[0]).toEqual({
      period: native.standard.schedule[0]!.month,
      date: native.standard.schedule[0]!.date,
      payment: native.standard.schedule[0]!.emi,
      principal: native.standard.schedule[0]!.principal,
      interest: native.standard.schedule[0]!.interest,
      prepayment: native.standard.schedule[0]!.prepayment,
      costs: native.monthlyOwnershipCost,
      balance: native.standard.schedule[0]!.balance,
      odNetUtilized: native.od.schedule[0]!.netUtilized,
    })
    expect(result.view.schedule.at(-1)?.balance).toBe(0)
  })
})
