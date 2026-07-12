import type {
  CarScenario,
  EducationDisbursement,
  EducationScenario,
  GenericScenario,
  PersonalScenario,
  SuiteScenario,
} from '../domain/calculators'
import type { LoanScenario, OdTransaction, Prepayment, RateChange } from '../domain/loan'

export const SUITE_VERSION = 2
const MAX_LIST_LENGTH = 100

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Invalid ${label}`)
  return value as Record<string, unknown>
}
const number = (value: Record<string, unknown>, key: string) => {
  const result = value[key]
  if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error(`Invalid ${key}`)
  return result
}
const string = (value: Record<string, unknown>, key: string) => {
  const result = value[key]
  if (typeof result !== 'string') throw new Error(`Invalid ${key}`)
  return result
}
const boolean = (value: Record<string, unknown>, key: string) => {
  const result = value[key]
  if (typeof result !== 'boolean') throw new Error(`Invalid ${key}`)
  return result
}
const oneOf = <T extends string>(value: Record<string, unknown>, key: string, allowed: readonly T[]) => {
  const result = string(value, key)
  if (!allowed.includes(result as T)) throw new Error(`Invalid ${key}`)
  return result as T
}
const list = <T extends { id: string }>(
  value: Record<string, unknown>,
  key: string,
  parse: (item: unknown) => T,
) => {
  const source = value[key]
  if (!Array.isArray(source) || source.length > MAX_LIST_LENGTH) throw new Error(`Invalid ${key}`)
  const parsed = source.map(parse)
  const ids = new Set<string>()
  parsed.forEach(({ id }) => {
    if (!id.trim() || ids.has(id)) throw new Error(`Invalid ${key} ID`)
    ids.add(id)
  })
  return parsed
}

const prepayment = (value: unknown): Prepayment => {
  const item = record(value, 'prepayment')
  return {
    id: string(item, 'id'),
    date: string(item, 'date'),
    amount: number(item, 'amount'),
    frequency: oneOf(item, 'frequency', ['once', 'monthly', 'quarterly', 'yearly'] as const),
  }
}
const rateChange = (value: unknown): RateChange => {
  const item = record(value, 'rate change')
  return {
    id: string(item, 'id'),
    date: string(item, 'date'),
    annualRate: number(item, 'annualRate'),
    mode: oneOf(item, 'mode', ['keep-emi', 'keep-tenure'] as const),
  }
}
const transaction = (value: unknown): OdTransaction => {
  const item = record(value, 'OD transaction')
  return {
    id: string(item, 'id'),
    date: string(item, 'date'),
    type: oneOf(item, 'type', ['deposit', 'withdrawal'] as const),
    amount: number(item, 'amount'),
  }
}
const disbursement = (value: unknown): EducationDisbursement => {
  const item = record(value, 'education disbursement')
  return { id: string(item, 'id'), date: string(item, 'date'), amount: number(item, 'amount') }
}

const generic = (value: unknown): GenericScenario => {
  const item = record(value, 'generic scenario')
  return {
    principal: number(item, 'principal'),
    annualRate: number(item, 'annualRate'),
    tenureMonths: number(item, 'tenureMonths'),
    startDate: string(item, 'startDate'),
    processingFee: number(item, 'processingFee'),
    prepayments: list(item, 'prepayments', prepayment),
    rateChanges: list(item, 'rateChanges', rateChange),
  }
}
const home = (value: unknown): LoanScenario => {
  const item = record(value, 'home scenario')
  const od = record(item.od, 'OD settings')
  return {
    homeValue: number(item, 'homeValue'),
    downPayment: number(item, 'downPayment'),
    downPaymentMode: oneOf(item, 'downPaymentMode', ['amount', 'percent'] as const),
    loanInsurance: number(item, 'loanInsurance'),
    annualRate: number(item, 'annualRate'),
    tenureMonths: number(item, 'tenureMonths'),
    startDate: string(item, 'startDate'),
    processingFee: number(item, 'processingFee'),
    processingFeeMode: oneOf(item, 'processingFeeMode', ['amount', 'percent'] as const),
    oneTimeExpenses: number(item, 'oneTimeExpenses'),
    oneTimeExpensesMode: oneOf(item, 'oneTimeExpensesMode', ['amount', 'percent'] as const),
    propertyTaxAnnual: number(item, 'propertyTaxAnnual'),
    propertyTaxMode: oneOf(item, 'propertyTaxMode', ['amount', 'percent'] as const),
    homeInsuranceAnnual: number(item, 'homeInsuranceAnnual'),
    homeInsuranceMode: oneOf(item, 'homeInsuranceMode', ['amount', 'percent'] as const),
    maintenanceMonthly: number(item, 'maintenanceMonthly'),
    rateChanges: list(item, 'rateChanges', rateChange),
    prepayments: list(item, 'prepayments', prepayment),
    od: {
      enabled: boolean(od, 'enabled'),
      premiumRate: number(od, 'premiumRate'),
      setupFee: number(od, 'setupFee'),
      annualFee: number(od, 'annualFee'),
      openingSurplus: number(od, 'openingSurplus'),
      openingSurplusMode: oneOf(od, 'openingSurplusMode', ['amount', 'percent'] as const),
      monthlyContribution: number(od, 'monthlyContribution'),
      transactionsEnabled: boolean(od, 'transactionsEnabled'),
      transactions: list(od, 'transactions', transaction),
    },
  }
}
const car = (value: unknown): CarScenario => {
  const item = record(value, 'car scenario')
  return {
    vehiclePrice: number(item, 'vehiclePrice'),
    downPayment: number(item, 'downPayment'),
    downPaymentMode: oneOf(item, 'downPaymentMode', ['amount', 'percent'] as const),
    registrationFees: number(item, 'registrationFees'),
    financeRegistrationFees: boolean(item, 'financeRegistrationFees'),
    financedInsurance: number(item, 'financedInsurance'),
    annualRate: number(item, 'annualRate'),
    tenureMonths: number(item, 'tenureMonths'),
    startDate: string(item, 'startDate'),
    processingFee: number(item, 'processingFee'),
    balloonAmount: number(item, 'balloonAmount'),
    expectedResaleValue: number(item, 'expectedResaleValue'),
    ownershipMonths: number(item, 'ownershipMonths'),
    prepayments: list(item, 'prepayments', prepayment),
    rateChanges: list(item, 'rateChanges', rateChange),
  }
}
const personal = (value: unknown): PersonalScenario => {
  const item = record(value, 'personal scenario')
  return {
    principal: number(item, 'principal'),
    quotedAnnualRate: number(item, 'quotedAnnualRate'),
    quotationMode: oneOf(item, 'quotationMode', ['reducing', 'flat'] as const),
    tenureMonths: number(item, 'tenureMonths'),
    startDate: string(item, 'startDate'),
    processingFee: number(item, 'processingFee'),
    processingFeeMode: oneOf(item, 'processingFeeMode', ['amount', 'percent'] as const),
    gstRate: number(item, 'gstRate'),
    insuranceDeduction: number(item, 'insuranceDeduction'),
    otherDeduction: number(item, 'otherDeduction'),
    prepayments: list(item, 'prepayments', prepayment),
  }
}
const education = (value: unknown): EducationScenario => {
  const item = record(value, 'education scenario')
  return {
    courseCost: number(item, 'courseCost'),
    ownContribution: number(item, 'ownContribution'),
    disbursements: list(item, 'disbursements', disbursement),
    studyAnnualRate: number(item, 'studyAnnualRate'),
    studyMonths: number(item, 'studyMonths'),
    moratoriumMonths: number(item, 'moratoriumMonths'),
    servicingMode: oneOf(item, 'servicingMode', ['none', 'full-interest', 'fixed-monthly'] as const),
    servicingAmount: number(item, 'servicingAmount'),
    repaymentAnnualRate: number(item, 'repaymentAnnualRate'),
    repaymentTenureMonths: number(item, 'repaymentTenureMonths'),
    startDate: string(item, 'startDate'),
    processingFee: number(item, 'processingFee'),
    prepayments: list(item, 'prepayments', prepayment),
  }
}

export const parseSuiteScenario = (value: unknown): SuiteScenario => {
  const source = record(value, 'suite scenario')
  const kind = oneOf(source, 'kind', ['generic', 'home', 'car', 'personal', 'education'] as const)
  switch (kind) {
    case 'generic': return { kind, value: generic(source.value) }
    case 'home': return { kind, value: home(source.value) }
    case 'car': return { kind, value: car(source.value) }
    case 'personal': return { kind, value: personal(source.value) }
    case 'education': return { kind, value: education(source.value) }
  }
}

export const serializeSuiteScenario = (scenario: SuiteScenario) => JSON.stringify(parseSuiteScenario(scenario))

export const parseSuiteScenarioJson = (json: string): SuiteScenario | null => {
  try {
    return parseSuiteScenario(JSON.parse(json) as unknown)
  } catch {
    return null
  }
}
