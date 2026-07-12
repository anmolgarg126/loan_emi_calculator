import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultScenario } from '../domain/loan'
import { defaultSuiteScenario } from '../domain/calculators'
import { decodeScenario, decodeSharedScenario, encodeScenario, encodeSuiteScenario, scenarioUrl } from './share'

afterEach(() => vi.unstubAllGlobals())

const encodeRaw = (payload: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

describe('scenario sharing', () => {
  it.each(['generic', 'home', 'car', 'personal', 'education'] as const)(
    'round-trips a %s scenario through v2',
    (kind) => {
      const scenario = defaultSuiteScenario(kind)
      expect(decodeSharedScenario(`#${encodeSuiteScenario(scenario)}`)).toEqual(scenario)
    },
  )

  it('wraps compatible v1 Home links in the suite contract', () => {
    const scenario = defaultScenario()
    expect(decodeSharedScenario(`#${encodeScenario(scenario)}`)).toEqual({ kind: 'home', value: scenario })
  })

  it('sets the calculator query while preserving the configured base', () => {
    vi.stubGlobal('window', { location: { origin: 'https://example.github.io' } })
    const scenario = defaultSuiteScenario('car')
    const url = new URL(scenarioUrl(scenario))

    expect(url.searchParams.get('calculator')).toBe('car')
    expect(decodeSharedScenario(url.hash)).toEqual(scenario)
  })

  it('rejects malformed and oversized v2 fragments', () => {
    expect(decodeSharedScenario('#v2=not-json')).toBeNull()
    expect(decodeSharedScenario(`#v2=${'a'.repeat(8_001)}`)).toBeNull()
  })

  it('round-trips a versioned scenario', () => {
    const scenario = defaultScenario()
    const fragment = encodeScenario(scenario)
    expect(decodeScenario(`#${fragment}`)).toEqual(scenario)
  })

  it.each([
    ['maximum loan', { homeValue: 1_000_000_000, downPayment: 0, annualRate: 50, tenureMonths: 480 }],
    ['month end', { startDate: '2026-01-31' }],
    ['opening percentage', { od: { enabled: true, openingSurplus: 25, openingSurplusMode: 'percent' } }],
  ] as const)('round-trips the %s boundary', (_name, patch) => {
    const base = defaultScenario()
    const scenario = {
      ...base,
      ...patch,
      od: 'od' in patch ? { ...base.od, ...patch.od } : base.od,
    }

    expect(decodeScenario(`#${encodeScenario(scenario)}`)).toEqual(scenario)
  })

  it.each([
    ['keep-emi', 'monthly'],
    ['keep-tenure', 'quarterly'],
    ['keep-emi', 'yearly'],
    ['keep-tenure', 'once'],
  ] as const)('round-trips %s resets with %s prepayments', (mode, frequency) => {
    const scenario = defaultScenario()
    scenario.rateChanges = [{ id: 'rate', date: scenario.startDate, annualRate: 10, mode }]
    scenario.prepayments = [{ id: 'prepay', date: scenario.startDate, amount: 1, frequency }]

    expect(decodeScenario(`#${encodeScenario(scenario)}`)).toEqual(scenario)
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

  it('preserves missing list-member numbers as invalid sentinels', () => {
    const decoded = decodeScenario(`#v1=${encodeRaw({
      rateChanges: [{ id: 'rate' }],
      prepayments: [{ id: 'prepay' }],
      od: { transactions: [{ id: 'tx' }] },
    })}`)

    expect(decoded).not.toBeNull()
    if (!decoded) throw new Error('Expected a structurally decoded scenario')
    const [rateChange] = decoded.rateChanges
    const [prepayment] = decoded.prepayments
    const [transaction] = decoded.od.transactions
    if (!rateChange || !prepayment || !transaction) throw new Error('Expected decoded list members')
    expect(rateChange.annualRate).toBeNaN()
    expect(prepayment.amount).toBeNaN()
    expect(transaction.amount).toBeNaN()
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
