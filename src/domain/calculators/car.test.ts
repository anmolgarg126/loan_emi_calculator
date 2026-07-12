import { describe, expect, it } from 'vitest'
import { addMonths, roundMoney } from '../loan'
import { calculateCar, defaultCarScenario } from './car'
import { calculateSuite, defaultSuiteScenario } from './index'
import type { CarScenario } from './types'

const carWith = (patch: Partial<CarScenario> = {}) => ({ ...defaultCarScenario(), ...patch })

describe('car calculator', () => {
  it('finances selected costs and keeps resale separate from ownership cash outflow', () => {
    const result = calculateCar({
      ...defaultCarScenario(),
      vehiclePrice: 2_000_000,
      downPayment: 400_000,
      downPaymentMode: 'amount',
      registrationFees: 200_000,
      financeRegistrationFees: true,
      financedInsurance: 50_000,
      balloonAmount: 300_000,
      expectedResaleValue: 700_000,
      ownershipMonths: 60,
    })

    expect(result.financedPrincipal).toBe(1_850_000)
    expect(result.schedule.at(-1)?.payment).toBeGreaterThanOrEqual(300_000)
    expect(result.netOwnershipCost).toBe(result.cashOutflowThroughHorizon - 700_000)
  })

  it('calculates exact amount and percentage financed principals', () => {
    expect(calculateCar(carWith({
      vehiclePrice: 1_234_567,
      downPayment: 12.34,
      downPaymentMode: 'percent',
      registrationFees: 12_345,
      financeRegistrationFees: true,
      financedInsurance: 6_789,
    })).financedPrincipal).toBe(1_101_355.43)
    expect(calculateCar(carWith({
      vehiclePrice: 1_234_567,
      downPayment: 234_567,
      downPaymentMode: 'amount',
    })).financedPrincipal).toBe(1_000_000)
  })

  it('accepts a derived financed principal at exactly ₹1 billion', () => {
    const result = calculateCar(carWith({
      vehiclePrice: 999_999_999,
      downPayment: 0,
      downPaymentMode: 'amount',
      registrationFees: 0.5,
      financeRegistrationFees: true,
      financedInsurance: 0.5,
    }))

    expect(result.errors).toEqual([])
    expect(result.financedPrincipal).toBe(1_000_000_000)
    expect(result.schedule.length).toBeGreaterThan(0)
  })

  it('rejects a derived financed principal above ₹1 billion', () => {
    const result = calculateCar(carWith({
      vehiclePrice: 999_999_999,
      downPayment: 0,
      downPaymentMode: 'amount',
      registrationFees: 0.5,
      financeRegistrationFees: true,
      financedInsurance: 0.51,
    }))

    expect(result.issues).toContainEqual({
      field: 'financedPrincipal',
      message: 'Financed principal must be above ₹0 and at most ₹100 crore.',
    })
    expect(result.schedule).toEqual([])
    expect([
      result.financedPrincipal,
      result.initialEmi,
      result.totalInterest,
      result.cashOutflowThroughHorizon,
    ].every(Number.isFinite)).toBe(true)
  })

  it('accounts for financed and unfinanced registration without double counting', () => {
    const base = {
      vehiclePrice: 100_000,
      downPayment: 20_000,
      downPaymentMode: 'amount' as const,
      registrationFees: 10_000,
      annualRate: 0,
      tenureMonths: 10,
      ownershipMonths: 10,
      startDate: '2026-01-01',
    }
    const cash = calculateCar(carWith({ ...base, financeRegistrationFees: false }))
    const financed = calculateCar(carWith({ ...base, financeRegistrationFees: true }))

    expect(cash.financedPrincipal).toBe(80_000)
    expect(financed.financedPrincipal).toBe(90_000)
    expect(cash.cashOutflowThroughHorizon).toBe(110_000)
    expect(financed.cashOutflowThroughHorizon).toBe(110_000)
  })

  it('settles the remaining loan at an ownership horizon before payoff', () => {
    const result = calculateCar(carWith({
      vehiclePrice: 100_000,
      downPayment: 20_000,
      downPaymentMode: 'amount',
      annualRate: 0,
      tenureMonths: 12,
      ownershipMonths: 6,
      startDate: '2026-01-01',
    }))

    expect(result.remainingLoanSettlement).toBe(result.schedule[5]?.balance)
    expect(result.cashOutflowThroughHorizon).toBe(100_000)
    expect(result.netOwnershipCost).toBe(100_000)
  })

  it('has no settlement when the horizon reaches payoff', () => {
    const result = calculateCar(carWith({
      annualRate: 0,
      tenureMonths: 12,
      ownershipMonths: 12,
      startDate: '2026-01-01',
    }))

    expect(result.remainingLoanSettlement).toBe(0)
    expect(result.schedule.at(-1)?.balance).toBe(0)
  })

  it('keeps the balloon protected at zero rate and through prepayments and rate resets', () => {
    const startDate = '2026-01-01'
    const result = calculateCar(carWith({
      vehiclePrice: 100_000,
      downPayment: 0,
      downPaymentMode: 'amount',
      annualRate: 0,
      tenureMonths: 12,
      ownershipMonths: 12,
      balloonAmount: 20_000,
      startDate,
      prepayments: [{ id: 'extra', date: startDate, amount: 10_000, frequency: 'once' }],
      rateChanges: [{ id: 'reset', date: addMonths(startDate, 1), annualRate: 12, mode: 'keep-tenure' }],
    }))

    expect(result.errors).toEqual([])
    expect(result.schedule[0]?.balance).toBe(83_333.33)
    expect(result.schedule.at(-1)?.principal).toBeGreaterThanOrEqual(20_000)
    expect(result.schedule.at(-1)?.balance).toBe(0)

    const capped = calculateCar(carWith({
      vehiclePrice: 100_000,
      downPayment: 0,
      downPaymentMode: 'amount',
      annualRate: 0,
      tenureMonths: 12,
      ownershipMonths: 12,
      balloonAmount: 20_000,
      startDate,
      prepayments: [{ id: 'large', date: startDate, amount: 100_000, frequency: 'once' }],
    }))
    expect(capped.warnings).not.toEqual([])
    expect(capped.schedule[0]?.balance).toBe(20_000)
    expect(capped.schedule.at(-1)?.principal).toBe(20_000)
  })

  it.each([
    ['vehiclePrice', { vehiclePrice: Number.NaN }],
    ['downPayment', { downPayment: Number.POSITIVE_INFINITY }],
    ['downPayment', { vehiclePrice: 100, downPayment: 101, downPaymentMode: 'amount' }],
    ['downPayment', { downPayment: 101, downPaymentMode: 'percent' }],
    ['downPaymentMode', { downPaymentMode: 'ratio' }],
    ['registrationFees', { registrationFees: -1 }],
    ['financedInsurance', { financedInsurance: 1_000_000_001 }],
    ['processingFee', { processingFee: Number.NaN }],
    ['expectedResaleValue', { expectedResaleValue: -1 }],
    ['annualRate', { annualRate: 51 }],
    ['tenureMonths', { tenureMonths: 12.5 }],
    ['ownershipMonths', { ownershipMonths: 0 }],
    ['startDate', { startDate: '2026-02-30' }],
    ['balloonAmount', { balloonAmount: 800_000 }],
  ])('blocks invalid %s input with finite empty output', (field, patch) => {
    const result = calculateCar(carWith(patch as Partial<CarScenario>))

    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ field })]))
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.schedule).toEqual([])
    expect([
      result.financedPrincipal,
      result.downPaymentAmount,
      result.initialEmi,
      result.totalInterest,
      result.cashOutflowThroughHorizon,
      result.remainingLoanSettlement,
      result.netOwnershipCost,
    ].every(Number.isFinite)).toBe(true)
  })

  it('blocks malformed, capped, duplicate, and invalid event members', () => {
    const startDate = '2026-01-01'
    const result = calculateCar(carWith({
      startDate,
      prepayments: Array.from({ length: 101 }, (_, index) => index === 100 ? null : {
        id: index < 2 ? 'same' : `prepay-${index}`,
        date: index === 1 ? '2026-01-02' : startDate,
        amount: index === 0 ? Number.NaN : 1,
        frequency: index === 0 ? 'weekly' : 'once',
      }) as unknown as CarScenario['prepayments'],
      rateChanges: [
        { id: 'same-rate', date: startDate, annualRate: Number.NaN, mode: 'recast' },
        { id: 'same-rate', date: startDate, annualRate: 9, mode: 'keep-emi' },
      ] as CarScenario['rateChanges'],
    }))

    expect(result.errors).toEqual(expect.arrayContaining([
      'Prepayments are limited to 100 entries.',
      'Prepayment IDs must be unique.',
      'Rate-change IDs must be unique.',
      `Only one rate change may apply on ${startDate}.`,
    ]))
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'prepayments.same.amount' }),
      expect.objectContaining({ field: 'prepayments.same.frequency' }),
      expect.objectContaining({ field: 'prepayments.100' }),
      expect.objectContaining({ field: 'rateChanges.same-rate.annualRate' }),
      expect.objectContaining({ field: 'rateChanges.same-rate.mode' }),
    ]))
    expect(result.schedule).toEqual([])
  })

  it.each([
    ['prepayments', null],
    ['prepayments', { bad: true }],
    ['rateChanges', null],
    ['rateChanges', 'bad'],
  ] as const)('never throws for runtime-invalid %s containers', (field, value) => {
    expect(() => calculateCar(carWith({ [field]: value } as unknown as Partial<CarScenario>))).not.toThrow()
    expect(calculateCar(carWith({ [field]: value } as unknown as Partial<CarScenario>)).schedule).toEqual([])
  })

  it('applies prepayments and rate changes on their public first-EMI row dates', () => {
    const startDate = '2026-01-01'
    const result = calculateCar(carWith({
      vehiclePrice: 120_000,
      downPayment: 0,
      downPaymentMode: 'amount',
      annualRate: 12,
      tenureMonths: 12,
      ownershipMonths: 12,
      startDate,
      prepayments: [{ id: 'opening', date: startDate, amount: 1_000, frequency: 'once' }],
      rateChanges: [{ id: 'opening-reset', date: startDate, annualRate: 24, mode: 'keep-tenure' }],
    }))

    expect(result.errors).toEqual([])
    expect(result.schedule[0]).toMatchObject({
      date: startDate,
      interest: 2_400,
      prepayment: 1_000,
    })
    expect(result.initialEmi).toBe(result.schedule[0]?.payment)
  })

  it('rejects events after the actual payoff date', () => {
    const startDate = '2026-01-01'
    const afterPayoff = addMonths(startDate, 12)
    const result = calculateCar(carWith({
      annualRate: 0,
      tenureMonths: 12,
      ownershipMonths: 12,
      startDate,
      prepayments: [{ id: 'late-extra', date: afterPayoff, amount: 1_000, frequency: 'once' }],
      rateChanges: [{ id: 'late-reset', date: afterPayoff, annualRate: 12, mode: 'keep-tenure' }],
    }))

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'prepayments.late-extra.date' }),
      expect.objectContaining({ field: 'rateChanges.late-reset.date' }),
    ]))
    expect(result.schedule).toEqual([])
  })

  it('blocks an infeasible engine schedule without exposing partial rows', () => {
    const startDate = '2026-01-01'
    const date = addMonths(startDate, 1)
    const result = calculateCar(carWith({
      startDate,
      rateChanges: [{ id: 'shock', date, annualRate: 50, mode: 'keep-emi' }],
    }))

    expect(result.errors.some((error) => error.includes(date))).toBe(true)
    expect(result.schedule).toEqual([])
  })

  it('reconciles schedule principal, interest, payments, and normalized costs', () => {
    const result = calculateCar(carWith({
      balloonAmount: 100_000,
      processingFee: 2_000,
      startDate: '2026-01-01',
    }))

    expect(result.errors).toEqual([])
    expect(roundMoney(result.schedule.reduce((sum, row) => sum + row.principal + row.prepayment, 0))).toBe(result.financedPrincipal)
    expect(roundMoney(result.schedule.reduce((sum, row) => sum + row.interest, 0))).toBe(result.totalInterest)
    expect(result.schedule.every((row) => row.costs === 0)).toBe(true)
  })

  it('dispatches through the Suite API and maps the native result into the unified view', () => {
    const scenario = defaultSuiteScenario('car')
    const result = calculateSuite(scenario)

    expect(result.kind).toBe('car')
    expect(result.native.financedPrincipal).toBe(800_000)
    expect(result.view.primary).toMatchObject({ label: 'Monthly EMI', value: result.native.initialEmi })
    expect(result.view.schedule).toBe(result.native.schedule)
    expect(result.view.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'financed-principal', value: 800_000 }),
      expect.objectContaining({ id: 'balloon', value: 0 }),
      expect.objectContaining({ id: 'net-ownership-cost', value: result.native.netOwnershipCost }),
      expect.objectContaining({ id: 'payoff-date', value: result.native.payoffDate }),
    ]))
  })

  it('is deterministic at the supported maximum fixture', () => {
    const scenario = carWith({
      vehiclePrice: 1_000_000_000,
      downPayment: 999_999_999,
      downPaymentMode: 'amount',
      annualRate: 50,
      tenureMonths: 480,
      ownershipMonths: 480,
      startDate: '2026-01-31',
    })

    expect(calculateCar(scenario)).toEqual(calculateCar(structuredClone(scenario)))
  })
})
