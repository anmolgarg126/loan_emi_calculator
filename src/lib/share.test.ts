import { describe, expect, it } from 'vitest'
import { defaultScenario } from '../domain/loan'
import { decodeScenario, encodeScenario } from './share'

const encodeRaw = (payload: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

describe('scenario sharing', () => {
  it('round-trips a versioned scenario', () => {
    const scenario = defaultScenario()
    const fragment = encodeScenario(scenario)
    expect(decodeScenario(`#${fragment}`)).toEqual(scenario)
  })

  it('ignores malformed fragments', () => {
    expect(decodeScenario('#v1=not-json')).toBeNull()
    expect(decodeScenario('#v1=e31')).toBeNull()
  })

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

  it.each(['rateChanges', 'prepayments', 'transactions'] as const)(
    'rejects %s lists over 100 entries',
    (list) => {
      const entries = Array.from({ length: 101 }, (_, index) => ({ id: String(index) }))
      const payload = list === 'transactions' ? { od: { transactions: entries } } : { [list]: entries }

      expect(decodeScenario(`#v1=${encodeRaw(payload)}`)).toBeNull()
    },
  )

  it.each([
    ['rateChanges', { id: 'same', date: '2026-08-01', annualRate: 9, mode: 'keep-emi' }],
    ['prepayments', { id: 'same', date: '2026-08-01', amount: 1, frequency: 'once' }],
    ['transactions', { id: 'same', date: '2026-08-01', type: 'deposit', amount: 1 }],
  ] as const)('rejects duplicate and blank IDs in %s', (list, entry) => {
    const duplicate = [{ ...entry }, { ...entry }]
    const blank = [{ ...entry, id: '  ' }]
    const payload = (entries: readonly unknown[]) => list === 'transactions'
      ? { od: { transactions: entries } }
      : { [list]: entries }

    expect(decodeScenario(`#v1=${encodeRaw(payload(duplicate))}`)).toBeNull()
    expect(decodeScenario(`#v1=${encodeRaw(payload(blank))}`)).toBeNull()
  })

  it('round-trips all declared fields and strips unknown nested keys', () => {
    const scenario = {
      ...defaultScenario(),
      homeValue: 7_500_000,
      downPayment: 1_500_000,
      downPaymentMode: 'amount' as const,
      loanInsurance: 25_000,
      annualRate: 8.25,
      tenureMonths: 180,
      startDate: '2027-07-01',
      processingFee: 15_000,
      processingFeeMode: 'amount' as const,
      oneTimeExpenses: 50_000,
      oneTimeExpensesMode: 'amount' as const,
      propertyTaxAnnual: 20_000,
      propertyTaxMode: 'amount' as const,
      homeInsuranceAnnual: 0.1,
      homeInsuranceMode: 'percent' as const,
      maintenanceMonthly: 4_000,
      rateChanges: [{ id: 'rate', date: '2027-08-01', annualRate: 7.5, mode: 'keep-tenure' as const }],
      prepayments: [{ id: 'prepay', date: '2027-09-01', amount: 10_000, frequency: 'quarterly' as const }],
      od: {
        ...defaultScenario().od,
        enabled: true,
        premiumRate: 0.5,
        setupFee: 2_000,
        annualFee: 1_000,
        openingSurplus: 5,
        openingSurplusMode: 'percent' as const,
        monthlyContribution: 3_000,
        transactionsEnabled: true,
        transactions: [{ id: 'tx', date: '2027-10-01', type: 'withdrawal' as const, amount: 5_000 }],
      },
    }

    expect(decodeScenario(`#${encodeScenario(scenario)}`)).toEqual(scenario)
    const decoded = decodeScenario(`#v1=${encodeRaw({
      rateChanges: [{ ...scenario.rateChanges[0], unknown: true }],
      od: { unknown: true, transactions: [{ ...scenario.od.transactions[0], unknown: true }] },
    })}`)
    expect(decoded?.rateChanges[0]).toEqual(scenario.rateChanges[0])
    expect(decoded?.od.transactions[0]).toEqual(scenario.od.transactions[0])
    expect(decoded?.od).not.toHaveProperty('unknown')
  })

  it('rejects fragments over the safety limit', () => {
    expect(decodeScenario(`#v1=${'a'.repeat(8_001)}`)).toBeNull()
  })

  it('refuses to generate an oversized share fragment', () => {
    const scenario = defaultScenario()
    scenario.od.transactions = Array.from({ length: 100 }, (_, index) => ({
      id: `${index}-${'x'.repeat(100)}`,
      date: scenario.startDate,
      type: 'deposit' as const,
      amount: index,
    }))
    expect(() => encodeScenario(scenario)).toThrow('too large to share')
  })
})
