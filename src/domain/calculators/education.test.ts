import { describe, expect, it } from 'vitest'
import { addMonths, roundMoney } from '../loan'
import { calculateSuite, defaultSuiteScenario } from './index'
import { calculateEducation, defaultEducationScenario } from './education'
import type { EducationScenario } from './types'

const educationWith = (patch: Partial<EducationScenario> = {}) => ({
  ...defaultEducationScenario(),
  ...patch,
})

describe('education loan calculator', () => {
  it('accrues study interest only after each disbursement', () => {
    const result = calculateEducation({
      ...defaultEducationScenario(),
      ownContribution: 0,
      disbursements: [
        { id: 'd1', date: '2026-08-01', amount: 500_000 },
        { id: 'd2', date: '2027-08-01', amount: 500_000 },
      ],
      studyAnnualRate: 10,
      studyMonths: 24,
      moratoriumMonths: 6,
      servicingMode: 'none',
    })

    expect(result.totalDisbursed).toBe(1_000_000)
    expect(result.capitalizedInterest).toBeGreaterThan(0)
    expect(result.repaymentPrincipal).toBe(result.totalDisbursed + result.capitalizedInterest)
  })

  it('full interest servicing prevents capitalization', () => {
    const result = calculateEducation({ ...defaultEducationScenario(), servicingMode: 'full-interest' })
    expect(result.capitalizedInterest).toBe(0)
    expect(result.servicedInterest).toBeGreaterThan(0)
  })

  it('uses Actual/365 across a leap day', () => {
    const result = calculateEducation(educationWith({
      courseCost: 730,
      ownContribution: 0,
      disbursements: [{ id: 'leap', date: '2023-03-01', amount: 730 }],
      studyAnnualRate: 50,
      studyMonths: 12,
      moratoriumMonths: 0,
      servicingMode: 'none',
      startDate: '2023-03-01',
    }))

    expect(result.capitalizedInterest).toBe(366)
  })

  it('applies fixed monthly servicing only against accrued interest', () => {
    const result = calculateEducation(educationWith({
      servicingMode: 'fixed-monthly',
      servicingAmount: 1_000,
      studyMonths: 12,
      moratoriumMonths: 0,
    }))

    expect(result.servicedInterest).toBe(12_000)
    expect(result.capitalizedInterest).toBeGreaterThan(0)
    expect(result.phaseRows.every((row) => row.payment <= row.outstandingPrincipal)).toBe(true)
  })

  it('applies repayment prepayments on the public first-EMI date', () => {
    const base = educationWith({
      startDate: '2026-01-01',
      studyMonths: 12,
      moratoriumMonths: 0,
      servicingMode: 'full-interest',
    })
    const repaymentStartDate = addMonths(base.startDate, 12)
    const result = calculateEducation({
      ...base,
      prepayments: [{ id: 'extra', date: repaymentStartDate, amount: 10_000, frequency: 'once' }],
    })

    expect(result.errors).toEqual([])
    expect(result.schedule[0]).toMatchObject({ date: repaymentStartDate, prepayment: 10_000 })
    expect(roundMoney(result.schedule.reduce((sum, row) => sum + row.principal + row.prepayment, 0))).toBe(result.repaymentPrincipal)
  })

  it('accepts 100 disbursements and rejects 101', () => {
    const startDate = '2026-01-01'
    const items = Array.from({ length: 100 }, (_, index) => ({
      id: `d-${index}`,
      date: addMonths(startDate, Math.floor(index / 10)),
      amount: 1,
    }))
    const accepted = calculateEducation(educationWith({
      courseCost: 100,
      ownContribution: 0,
      startDate,
      studyMonths: 12,
      moratoriumMonths: 0,
      disbursements: items,
    }))
    const rejected = calculateEducation(educationWith({
      courseCost: 101,
      ownContribution: 0,
      startDate,
      studyMonths: 12,
      moratoriumMonths: 0,
      disbursements: [...items, { id: 'd-100', date: addMonths(startDate, 10), amount: 1 }],
    }))

    expect(accepted.errors).toEqual([])
    expect(accepted.totalDisbursed).toBe(100)
    expect(rejected.issues).toContainEqual(expect.objectContaining({ field: 'disbursements' }))
    expect(rejected.schedule).toEqual([])
  })

  it('blocks duplicate IDs, unordered dates, and over-disbursement atomically', () => {
    const result = calculateEducation(educationWith({
      courseCost: 100_000,
      ownContribution: 20_000,
      startDate: '2026-01-01',
      disbursements: [
        { id: 'same', date: '2026-03-01', amount: 50_000 },
        { id: 'same', date: '2026-02-01', amount: 50_000 },
      ],
    }))

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'disbursements' }),
      expect.objectContaining({ field: 'disbursements.1.date' }),
      expect.objectContaining({ field: 'totalDisbursed' }),
    ]))
    expect(result.phaseRows).toEqual([])
    expect(result.schedule).toEqual([])
  })

  it.each([
    ['courseCost', { courseCost: Number.NaN }],
    ['ownContribution', { ownContribution: -1 }],
    ['ownContribution', { courseCost: 100, ownContribution: 101 }],
    ['studyAnnualRate', { studyAnnualRate: 51 }],
    ['studyMonths', { studyMonths: 0 }],
    ['moratoriumMonths', { moratoriumMonths: -1 }],
    ['servicingMode', { servicingMode: 'partial' }],
    ['servicingAmount', { servicingMode: 'fixed-monthly', servicingAmount: 0 }],
    ['repaymentAnnualRate', { repaymentAnnualRate: 51 }],
    ['repaymentTenureMonths', { repaymentTenureMonths: 0 }],
    ['startDate', { startDate: '2026-02-30' }],
    ['processingFee', { processingFee: -1 }],
  ])('blocks invalid %s input with finite empty output', (field, patch) => {
    const result = calculateEducation(educationWith(patch as Partial<EducationScenario>))

    expect(result.issues).toContainEqual(expect.objectContaining({ field }))
    expect(result.phaseRows).toEqual([])
    expect(result.schedule).toEqual([])
    expect([result.totalDisbursed, result.capitalizedInterest, result.initialEmi, result.totalCost].every(Number.isFinite)).toBe(true)
  })

  it.each([
    ['disbursements', null],
    ['disbursements', { bad: true }],
    ['prepayments', null],
    ['prepayments', 'bad'],
  ] as const)('never throws for runtime-invalid %s containers', (field, value) => {
    const scenario = educationWith({ [field]: value } as unknown as Partial<EducationScenario>)
    expect(() => calculateEducation(scenario)).not.toThrow()
    expect(calculateEducation(scenario).schedule).toEqual([])
  })

  it('dispatches through the Suite API with phase-aware metrics', () => {
    const scenario = defaultSuiteScenario('education')
    const result = calculateSuite(scenario)

    expect(result.kind).toBe('education')
    expect(result.view.primary.value).toBe(result.native.initialEmi)
    expect(result.view.schedule).toBe(result.native.schedule)
    expect(result.view.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'total-disbursed', value: result.native.totalDisbursed }),
      expect.objectContaining({ id: 'capitalized-interest', value: result.native.capitalizedInterest }),
      expect.objectContaining({ id: 'repayment-principal', value: result.native.repaymentPrincipal }),
    ]))
  })
})
