import { describe, expect, it } from 'vitest'
import { addMonths, roundMoney } from '../loan'
import { calculateSuite, defaultSuiteScenario } from './index'
import { calculatePersonal, defaultPersonalScenario } from './personal'
import type { PersonalScenario } from './types'

const personalWith = (patch: Partial<PersonalScenario> = {}) => ({ ...defaultPersonalScenario(), ...patch })

describe('personal loan calculator', () => {
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
    expect(result.totalInterest).toBe(120_000)
    expect(result.schedule).toHaveLength(24)
    expect(result.schedule.at(-1)?.balance).toBe(0)
  })

  it('matches the quoted nominal rate when reducing-balance deductions are zero', () => {
    const result = calculatePersonal(personalWith({
      principal: 1_000_000,
      quotedAnnualRate: 10,
      tenureMonths: 60,
    }))

    expect(result.effectiveApr).toBeCloseTo(10, 3)
    expect(result.totalRepayment).toBe(roundMoney(1_000_000 + result.totalInterest))
  })

  it('supports amount fees and includes every upfront deduction', () => {
    const result = calculatePersonal(personalWith({
      principal: 100_000,
      processingFee: 1_000,
      processingFeeMode: 'amount',
      gstRate: 18,
      insuranceDeduction: 500,
      otherDeduction: 250,
    }))

    expect(result).toMatchObject({
      processingFeeAmount: 1_000,
      gstAmount: 180,
      totalDeductions: 1_930,
      netDisbursed: 98_070,
    })
  })

  it('applies a flat-loan prepayment on its public EMI date and shortens payoff', () => {
    const startDate = '2026-01-01'
    const result = calculatePersonal(personalWith({
      principal: 120_000,
      quotedAnnualRate: 12,
      quotationMode: 'flat',
      tenureMonths: 12,
      startDate,
      prepayments: [{ id: 'extra', date: startDate, amount: 60_000, frequency: 'once' }],
    }))

    expect(result.errors).toEqual([])
    expect(result.schedule[0]).toMatchObject({ date: startDate, prepayment: 60_000 })
    expect(result.schedule.length).toBeLessThan(12)
    expect(result.schedule.at(-1)?.balance).toBe(0)
    expect(roundMoney(result.schedule.reduce((sum, row) => sum + row.principal + row.prepayment, 0))).toBe(120_000)
  })

  it('blocks a non-positive net disbursal without exposing partial results', () => {
    const result = calculatePersonal(personalWith({
      principal: 100_000,
      processingFee: 100_000,
      processingFeeMode: 'amount',
    }))

    expect(result.issues).toContainEqual(expect.objectContaining({ field: 'netDisbursed' }))
    expect(result.schedule).toEqual([])
    expect([result.netDisbursed, result.effectiveApr, result.totalRepayment].every(Number.isFinite)).toBe(true)
  })

  it.each([
    ['principal', { principal: Number.NaN }],
    ['quotedAnnualRate', { quotedAnnualRate: 51 }],
    ['quotationMode', { quotationMode: 'simple' }],
    ['tenureMonths', { tenureMonths: 0 }],
    ['startDate', { startDate: '2026-02-30' }],
    ['processingFee', { processingFee: -1 }],
    ['processingFee', { processingFee: 101, processingFeeMode: 'percent' }],
    ['processingFeeMode', { processingFeeMode: 'ratio' }],
    ['gstRate', { gstRate: 101 }],
    ['insuranceDeduction', { insuranceDeduction: Number.POSITIVE_INFINITY }],
    ['otherDeduction', { otherDeduction: -1 }],
  ])('blocks invalid %s input with finite empty output', (field, patch) => {
    const result = calculatePersonal(personalWith(patch as Partial<PersonalScenario>))

    expect(result.issues).toContainEqual(expect.objectContaining({ field }))
    expect(result.schedule).toEqual([])
    expect([result.netDisbursed, result.initialEmi, result.effectiveApr, result.totalRepayment].every(Number.isFinite)).toBe(true)
  })

  it('blocks malformed, duplicate, invalid, and post-payoff prepayments', () => {
    const startDate = '2026-01-01'
    const result = calculatePersonal(personalWith({
      tenureMonths: 12,
      startDate,
      prepayments: [
        { id: 'same', date: startDate, amount: Number.NaN, frequency: 'weekly' },
        { id: 'same', date: '2026-01-02', amount: 1, frequency: 'once' },
        { id: 'late', date: addMonths(startDate, 12), amount: 1, frequency: 'once' },
        null,
      ] as unknown as PersonalScenario['prepayments'],
    }))

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'prepayments' }),
      expect.objectContaining({ field: 'prepayments.same.amount' }),
      expect.objectContaining({ field: 'prepayments.same.frequency' }),
      expect.objectContaining({ field: 'prepayments.same.date' }),
      expect.objectContaining({ field: 'prepayments.3' }),
    ]))
    expect(result.schedule).toEqual([])
  })

  it('never throws for a runtime-invalid prepayment container', () => {
    const scenario = personalWith({ prepayments: null } as unknown as Partial<PersonalScenario>)
    expect(() => calculatePersonal(scenario)).not.toThrow()
    expect(calculatePersonal(scenario).schedule).toEqual([])
  })

  it('dispatches through the Suite API with a normalized view', () => {
    const scenario = defaultSuiteScenario('personal')
    const result = calculateSuite(scenario)

    expect(result.kind).toBe('personal')
    expect(result.view.primary.value).toBe(result.native.initialEmi)
    expect(result.view.schedule).toBe(result.native.schedule)
    expect(result.view.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'net-disbursed', value: result.native.netDisbursed }),
      expect.objectContaining({ id: 'effective-apr', value: result.native.effectiveApr }),
      expect.objectContaining({ id: 'total-repayment', value: result.native.totalRepayment }),
    ]))
  })
})
