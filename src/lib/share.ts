import {
  defaultScenario,
  type LoanScenario,
  type OdTransaction,
  type Prepayment,
  type RateChange,
} from '../domain/loan'

const VERSION = 'v1'
const MAX_FRAGMENT_LENGTH = 8_000
const MAX_LIST_LENGTH = 100

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const optionalNumber = (record: Record<string, unknown>, key: string, fallback: number) => {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${key}`)
  return value
}

const optionalString = (record: Record<string, unknown>, key: string, fallback: string) => {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string') throw new Error(`Invalid ${key}`)
  return value
}

const optionalBoolean = (record: Record<string, unknown>, key: string, fallback: boolean) => {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new Error(`Invalid ${key}`)
  return value
}

const optionalEnum = <T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
) => {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`Invalid ${key}`)
  return value as T
}

const parseRateChange = (value: unknown): RateChange => {
  if (!isRecord(value)) throw new Error('Invalid rate change')
  return {
    id: optionalString(value, 'id', ''),
    date: optionalString(value, 'date', ''),
    annualRate: optionalNumber(value, 'annualRate', Number.NaN),
    mode: optionalEnum(value, 'mode', ['keep-emi', 'keep-tenure'] as const, 'keep-emi'),
  }
}

const parsePrepayment = (value: unknown): Prepayment => {
  if (!isRecord(value)) throw new Error('Invalid prepayment')
  return {
    id: optionalString(value, 'id', ''),
    date: optionalString(value, 'date', ''),
    amount: optionalNumber(value, 'amount', Number.NaN),
    frequency: optionalEnum(value, 'frequency', ['once', 'monthly', 'quarterly', 'yearly'] as const, 'once'),
  }
}

const parseTransaction = (value: unknown): OdTransaction => {
  if (!isRecord(value)) throw new Error('Invalid OD transaction')
  return {
    id: optionalString(value, 'id', ''),
    date: optionalString(value, 'date', ''),
    type: optionalEnum(value, 'type', ['deposit', 'withdrawal'] as const, 'deposit'),
    amount: optionalNumber(value, 'amount', Number.NaN),
  }
}

const parseList = <T extends { id: string }>(
  value: unknown,
  parser: (item: unknown) => T,
): T[] => {
  if (!Array.isArray(value) || value.length > MAX_LIST_LENGTH) throw new Error('Invalid list')
  const parsed = value.map(parser)
  const ids = new Set<string>()
  parsed.forEach(({ id }) => {
    if (!id.trim() || ids.has(id)) throw new Error('Invalid ID')
    ids.add(id)
  })
  return parsed
}

const optionalList = <T extends { id: string }>(
  record: Record<string, unknown>,
  key: string,
  parser: (item: unknown) => T,
) => record[key] === undefined ? [] : parseList(record[key], parser)

const parseScenario = (value: unknown): LoanScenario => {
  if (!isRecord(value)) throw new Error('Invalid scenario')
  const defaults = defaultScenario()
  const odValue = value.od
  if (odValue !== undefined && !isRecord(odValue)) throw new Error('Invalid OD settings')
  const od = odValue ?? {}

  return {
    homeValue: optionalNumber(value, 'homeValue', defaults.homeValue),
    downPayment: optionalNumber(value, 'downPayment', defaults.downPayment),
    downPaymentMode: optionalEnum(value, 'downPaymentMode', ['amount', 'percent'] as const, defaults.downPaymentMode),
    loanInsurance: optionalNumber(value, 'loanInsurance', defaults.loanInsurance),
    annualRate: optionalNumber(value, 'annualRate', defaults.annualRate),
    tenureMonths: optionalNumber(value, 'tenureMonths', defaults.tenureMonths),
    startDate: optionalString(value, 'startDate', defaults.startDate),
    processingFee: optionalNumber(value, 'processingFee', defaults.processingFee),
    processingFeeMode: optionalEnum(value, 'processingFeeMode', ['amount', 'percent'] as const, defaults.processingFeeMode),
    oneTimeExpenses: optionalNumber(value, 'oneTimeExpenses', defaults.oneTimeExpenses),
    oneTimeExpensesMode: optionalEnum(value, 'oneTimeExpensesMode', ['amount', 'percent'] as const, defaults.oneTimeExpensesMode),
    propertyTaxAnnual: optionalNumber(value, 'propertyTaxAnnual', defaults.propertyTaxAnnual),
    propertyTaxMode: optionalEnum(value, 'propertyTaxMode', ['amount', 'percent'] as const, defaults.propertyTaxMode),
    homeInsuranceAnnual: optionalNumber(value, 'homeInsuranceAnnual', defaults.homeInsuranceAnnual),
    homeInsuranceMode: optionalEnum(value, 'homeInsuranceMode', ['amount', 'percent'] as const, defaults.homeInsuranceMode),
    maintenanceMonthly: optionalNumber(value, 'maintenanceMonthly', defaults.maintenanceMonthly),
    rateChanges: optionalList(value, 'rateChanges', parseRateChange),
    prepayments: optionalList(value, 'prepayments', parsePrepayment),
    od: {
      enabled: optionalBoolean(od, 'enabled', defaults.od.enabled),
      premiumRate: optionalNumber(od, 'premiumRate', defaults.od.premiumRate),
      setupFee: optionalNumber(od, 'setupFee', defaults.od.setupFee),
      annualFee: optionalNumber(od, 'annualFee', defaults.od.annualFee),
      openingSurplus: optionalNumber(od, 'openingSurplus', defaults.od.openingSurplus),
      openingSurplusMode: optionalEnum(od, 'openingSurplusMode', ['amount', 'percent'] as const, defaults.od.openingSurplusMode),
      monthlyContribution: optionalNumber(od, 'monthlyContribution', defaults.od.monthlyContribution),
      transactionsEnabled: optionalBoolean(od, 'transactionsEnabled', defaults.od.transactionsEnabled),
      transactions: optionalList(od, 'transactions', parseTransaction),
    },
  }
}

const toBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const fromBase64Url = (value: string) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

export const encodeScenario = (scenario: LoanScenario) => {
  const fragment = `${VERSION}=${toBase64Url(JSON.stringify(scenario))}`
  if (fragment.length > MAX_FRAGMENT_LENGTH) {
    throw new Error('This scenario is too large to share. Remove some dated OD transactions.')
  }
  return fragment
}

export const decodeScenario = (hash: string): LoanScenario | null => {
  const fragment = hash.replace(/^#/, '')
  if (!fragment || fragment.length > MAX_FRAGMENT_LENGTH || !fragment.startsWith(`${VERSION}=`)) return null
  try {
    const payload = fragment.slice(VERSION.length + 1)
    if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) return null
    const decoded = fromBase64Url(payload)
    if (toBase64Url(decoded) !== payload) return null
    return parseScenario(JSON.parse(decoded) as unknown)
  } catch {
    return null
  }
}

export const scenarioUrl = (scenario: LoanScenario) => {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin)
  base.hash = encodeScenario(scenario)
  return base.toString()
}

export const copyScenarioUrl = async (scenario: LoanScenario) => {
  const url = scenarioUrl(scenario)
  await navigator.clipboard.writeText(url)
  return url
}
