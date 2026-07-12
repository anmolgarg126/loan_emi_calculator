import { describe, expect, it } from 'vitest'
import { addMonths, calculateEmi, calculateLoan, defaultScenario, roundMoney } from '../loan'
import { calculateSuite, defaultSuiteScenario } from './index'
import type { GenericScenario } from './types'

const genericWith = (patch: Partial<GenericScenario>) => ({
  kind: 'generic' as const,
  value: { ...defaultSuiteScenario('generic').value, ...patch },
})

describe('Generic calculator', () => {
  it('calculates the audited lender-neutral EMI schedule', () => {
    const scenario = defaultSuiteScenario('generic')
    const result = calculateSuite(scenario)

    expect(result.kind).toBe('generic')
    expect(result.view.primary.label).toBe('Monthly EMI')
    expect(result.view.errors).toEqual([])
    expect(result.view.schedule.length).toBeGreaterThan(0)
    expect(result.view.schedule[0]?.date).toBe(scenario.value.startDate)
    expect(result.view.schedule.at(-1)?.balance).toBe(0)
    expect(result.native.initialEmi).toBe(21_247.04)
    expect(result.native.totalInterest).toBe(274_822.84)
    expect(result.native.totalRepayment).toBe(1_274_822.84)
  })

  it('ignores runtime-cast internal amortization controls', () => {
    const base = defaultSuiteScenario('generic').value
    const injected = {
      ...base,
      initialEmiOverride: 1,
      keepTenureTargetMonths: 1,
    } as GenericScenario

    const expected = calculateSuite({ kind: 'generic', value: base })
    const result = calculateSuite({ kind: 'generic', value: injected })

    expect(result.native).toEqual(expected.native)
    expect(result.view).toEqual(expected.view)
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

  it.each([
    ['prepayments', null],
    ['prepayments', { bad: true }],
    ['prepayments', 'bad'],
    ['rateChanges', null],
    ['rateChanges', { bad: true }],
    ['rateChanges', 'bad'],
  ] as const)('blocks a runtime-invalid %s container', (field, value) => {
    const result = calculateSuite(genericWith({
      [field]: value,
    } as unknown as Partial<GenericScenario>))

    expect(result.view.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field }),
    ]))
    expect(result.native.schedule).toEqual([])
    expect(result.view.schedule).toEqual([])
    expect([
      result.native.initialEmi,
      result.native.totalInterest,
      result.native.totalRepayment,
      result.view.primary.value,
    ].every((item) => typeof item === 'number' && Number.isFinite(item))).toBe(true)
  })

  it('applies a prepayment on its public EMI date', () => {
    const startDate = '2026-01-31'
    const date = addMonths(startDate, 1)
    const result = calculateSuite(genericWith({
      principal: 120_000,
      annualRate: 0,
      tenureMonths: 12,
      startDate,
      prepayments: [{ id: 'extra', date, amount: 20_000, frequency: 'once' }],
    }))

    expect(result.view.errors).toEqual([])
    expect(result.view.schedule[0]?.date).toBe(startDate)
    expect(result.view.schedule.find((row) => row.prepayment > 0)).toMatchObject({ date, prepayment: 20_000 })
  })

  it.each(['keep-emi', 'keep-tenure'] as const)('applies a %s rate change on its public EMI date', (mode) => {
    const startDate = '2026-01-01'
    const date = addMonths(startDate, 2)
    const annualRate = 24
    const result = calculateSuite(genericWith({
      principal: 120_000,
      annualRate: 12,
      tenureMonths: 12,
      startDate,
      rateChanges: [{ id: 'reset', date, annualRate, mode }],
    }))
    const before = result.view.schedule[1]!
    const changed = result.view.schedule[2]!

    expect(before.date).toBe(addMonths(startDate, 1))
    expect(before.interest).toBe(roundMoney(result.view.schedule[0]!.balance * 12 / 1200))
    expect(before.payment).toBe(result.native.initialEmi)
    expect(changed.date).toBe(date)
    expect(changed.interest).toBe(roundMoney(before.balance * annualRate / 1200))
    expect(result.scenario.rateChanges[0]?.date).toBe(date)
    if (mode === 'keep-emi') expect(changed.payment).toBe(result.native.initialEmi)
    else expect(changed.payment).toBe(calculateEmi(before.balance, annualRate, 10))
  })

  it('uses a first-date keep-tenure reset EMI as the headline', () => {
    const startDate = '2026-01-01'
    const result = calculateSuite(genericWith({
      principal: 120_000,
      annualRate: 12,
      tenureMonths: 12,
      startDate,
      rateChanges: [{ id: 'opening-reset', date: startDate, annualRate: 24, mode: 'keep-tenure' }],
    }))

    expect(result.view.errors).toEqual([])
    expect(result.view.schedule[0]).toMatchObject({ date: startDate, interest: 2_400, payment: 11_347.15 })
    expect(result.native.initialEmi).toBe(result.view.schedule[0]!.payment)
    expect(result.view.primary.value).toBe(result.view.schedule[0]!.payment)
  })

  it('preserves the original EMI for a first-date keep-EMI reset', () => {
    const startDate = '2026-01-01'
    const preservedEmi = calculateEmi(120_000, 12, 12)
    const result = calculateSuite(genericWith({
      principal: 120_000,
      annualRate: 12,
      tenureMonths: 12,
      startDate,
      rateChanges: [{ id: 'opening-reset', date: startDate, annualRate: 24, mode: 'keep-emi' }],
    }))

    expect(result.view.errors).toEqual([])
    expect(result.view.schedule[0]).toMatchObject({ date: startDate, interest: 2_400, payment: preservedEmi })
    expect(result.native.initialEmi).toBe(preservedEmi)
    expect(result.view.primary.value).toBe(result.view.schedule[0]!.payment)
  })

  it('accepts events on the first EMI date and rejects dates before it', () => {
    const startDate = '2026-01-01'
    const valid = calculateSuite(genericWith({
      startDate,
      prepayments: [{ id: 'opening', date: startDate, amount: 1_000, frequency: 'once' }],
    }))
    const invalid = calculateSuite(genericWith({
      startDate,
      rateChanges: [{ id: 'early', date: '2025-12-01', annualRate: 8, mode: 'keep-tenure' }],
    }))

    expect(valid.view.errors).toEqual([])
    expect(valid.view.schedule[0]?.prepayment).toBe(1_000)
    expect(invalid.view.issues).toContainEqual({
      field: 'rateChanges.early.date',
      message: 'Rate change must fall on an EMI date on or after the first EMI date.',
    })
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

  it('blocks partial schedules when a valid scenario becomes infeasible', () => {
    const base = defaultSuiteScenario('generic').value
    const date = addMonths(base.startDate, 1)
    const result = calculateSuite(genericWith({
      rateChanges: [{
        id: 'payment-shock',
        date,
        annualRate: 50,
        mode: 'keep-emi',
      }],
    }))

    expect(result.view.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'scenario' }),
    ]))
    expect(result.view.errors.length).toBeGreaterThan(0)
    expect(result.view.errors.some((error) => error.includes(date))).toBe(true)
    expect(result.native.schedule).toEqual([])
    expect(result.view.schedule).toEqual([])
    expect([
      result.native.initialEmi,
      result.native.totalInterest,
      result.native.totalRepayment,
      result.view.primary.value,
    ].every((value) => typeof value === 'number' && Number.isFinite(value))).toBe(true)
    expect(result.native.initialEmi).toBe(0)
    expect(result.native.totalInterest).toBe(0)
    expect(result.native.totalRepayment).toBe(0)
    expect(result.native.payoffDate).toBe(base.startDate)
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
      costs: native.standard.schedule[0]!.ownershipCost,
      balance: native.standard.schedule[0]!.balance,
      odNetUtilized: native.od.schedule[0]!.netUtilized,
    })
    expect(result.view.schedule.slice(0, 2).map(({ costs }) => costs)).toEqual(
      native.standard.schedule.slice(0, 2).map(({ ownershipCost }) => ownershipCost),
    )
    expect(result.view.schedule.at(-1)?.balance).toBe(0)
  })

  it('blocks the normalized Home view when the native OD ledger aborts', () => {
    const base = defaultScenario()
    const scenario = {
      ...base,
      od: {
        ...base.od,
        enabled: true,
        transactionsEnabled: true,
        transactions: [{ id: 'invalid', date: base.startDate, type: 'withdrawal' as const, amount: 100 }],
      },
    }
    const native = calculateLoan(scenario)
    const result = calculateSuite({ kind: 'home', value: scenario })

    expect(native.errors.length).toBeGreaterThan(0)
    expect(native.standard.schedule.length).toBeGreaterThan(0)
    expect(result.native).toEqual(native)
    expect(result.view.primary.value).toBe(0)
    expect(result.view.schedule).toEqual([])
    expect(result.view.issues).toEqual(native.issues)
    expect(result.view.errors).toEqual(native.errors)
    expect(result.view.warnings).toEqual(native.warnings)
    expect(result.view.metrics
      .filter((metric) => typeof metric.value === 'number')
      .every((metric) => Number.isFinite(metric.value))).toBe(true)
  })
})
