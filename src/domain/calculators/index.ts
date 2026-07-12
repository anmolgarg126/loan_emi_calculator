import { calculateLoan, defaultScenario, type LoanScenario } from '../loan'
import { calculateGeneric, defaultGenericScenario } from './generic'
import { calculateCar, defaultCarScenario } from './car'
import { calculatePersonal, defaultPersonalScenario } from './personal'
import { calculateEducation, defaultEducationScenario } from './education'
import type { CarScenario, EducationScenario, GenericScenario, PersonalScenario, SuiteResult, SuiteScenario, UnifiedScheduleRow } from './types'

export type * from './types'
export { calculateGeneric, defaultGenericScenario } from './generic'
export type { GenericResult } from './generic'
export { calculateCar, defaultCarScenario } from './car'
export { calculatePersonal, defaultPersonalScenario } from './personal'
export { calculateEducation, defaultEducationScenario } from './education'

export function defaultSuiteScenario(kind: 'generic'): { kind: 'generic'; value: GenericScenario }
export function defaultSuiteScenario(kind: 'home'): { kind: 'home'; value: LoanScenario }
export function defaultSuiteScenario(kind: 'car'): { kind: 'car'; value: CarScenario }
export function defaultSuiteScenario(kind: 'personal'): { kind: 'personal'; value: PersonalScenario }
export function defaultSuiteScenario(kind: 'education'): { kind: 'education'; value: EducationScenario }
export function defaultSuiteScenario(kind: 'generic' | 'home' | 'car' | 'personal' | 'education'): SuiteScenario
export function defaultSuiteScenario(kind: 'generic' | 'home' | 'car' | 'personal' | 'education'): SuiteScenario {
  switch (kind) {
    case 'generic': return { kind, value: defaultGenericScenario() }
    case 'home': return { kind, value: defaultScenario() }
    case 'car': return { kind, value: defaultCarScenario() }
    case 'personal': return { kind, value: defaultPersonalScenario() }
    case 'education': return { kind, value: defaultEducationScenario() }
  }
}

export const calculateEducationAdapter = (scenario: EducationScenario): Extract<SuiteResult, { kind: 'education' }> => {
  const native = calculateEducation(scenario)
  return {
    kind: 'education',
    scenario,
    native,
    view: {
      primary: { id: 'monthly-emi', label: 'Repayment EMI', value: native.initialEmi, format: 'currency' },
      metrics: [
        { id: 'total-disbursed', label: 'Total disbursed', value: native.totalDisbursed, format: 'currency' },
        { id: 'serviced-interest', label: 'Interest serviced', value: native.servicedInterest, format: 'currency' },
        { id: 'capitalized-interest', label: 'Capitalized interest', value: native.capitalizedInterest, format: 'currency' },
        { id: 'repayment-principal', label: 'Repayment principal', value: native.repaymentPrincipal, format: 'currency' },
        { id: 'repayment-interest', label: 'Repayment interest', value: native.repaymentInterest, format: 'currency' },
        { id: 'total-cost', label: 'Total cost', value: native.totalCost, format: 'currency' },
        { id: 'repayment-start', label: 'Repayment starts', value: native.repaymentStartDate, format: 'date' },
        { id: 'payoff-date', label: 'Payoff date', value: native.payoffDate, format: 'date' },
      ],
      schedule: native.schedule,
      issues: native.issues,
      errors: native.errors,
      warnings: native.warnings,
    },
  }
}

export const calculatePersonalAdapter = (scenario: PersonalScenario): Extract<SuiteResult, { kind: 'personal' }> => {
  const native = calculatePersonal(scenario)
  return {
    kind: 'personal',
    scenario,
    native,
    view: {
      primary: { id: 'monthly-emi', label: 'Monthly EMI', value: native.initialEmi, format: 'currency' },
      metrics: [
        { id: 'quoted-rate', label: 'Quoted rate', value: native.quotedAnnualRate, format: 'percentage' },
        { id: 'effective-apr', label: 'Effective APR', value: native.effectiveApr, format: 'percentage' },
        { id: 'net-disbursed', label: 'Net amount received', value: native.netDisbursed, format: 'currency' },
        { id: 'total-deductions', label: 'Total deductions', value: native.totalDeductions, format: 'currency' },
        { id: 'total-interest', label: 'Total interest', value: native.totalInterest, format: 'currency' },
        { id: 'total-repayment', label: 'Total repayment', value: native.totalRepayment, format: 'currency' },
        { id: 'payoff-date', label: 'Payoff date', value: native.payoffDate, format: 'date' },
      ],
      schedule: native.schedule,
      issues: native.issues,
      errors: native.errors,
      warnings: native.warnings,
    },
  }
}

export const calculateCarAdapter = (scenario: CarScenario): Extract<SuiteResult, { kind: 'car' }> => {
  const native = calculateCar(scenario)
  return {
    kind: 'car',
    scenario,
    native,
    view: {
      primary: { id: 'monthly-emi', label: 'Monthly EMI', value: native.initialEmi, format: 'currency' },
      metrics: [
        { id: 'financed-principal', label: 'Financed principal', value: native.financedPrincipal, format: 'currency' },
        { id: 'balloon', label: 'Balloon amount', value: native.balloonAmount, format: 'currency' },
        { id: 'total-interest', label: 'Total interest', value: native.totalInterest, format: 'currency' },
        { id: 'remaining-settlement', label: 'Remaining loan settlement', value: native.remainingLoanSettlement, format: 'currency' },
        { id: 'expected-resale', label: 'Expected resale value', value: Number.isFinite(scenario.expectedResaleValue) ? scenario.expectedResaleValue : 0, format: 'currency' },
        { id: 'net-ownership-cost', label: 'Net ownership cost', value: native.netOwnershipCost, format: 'currency' },
        { id: 'payoff-date', label: 'Payoff date', value: native.payoffDate, format: 'date' },
      ],
      schedule: native.schedule,
      issues: native.issues,
      errors: native.errors,
      warnings: native.warnings,
    },
  }
}

export const calculateHomeAdapter = (scenario: LoanScenario): Extract<SuiteResult, { kind: 'home' }> => {
  const native = calculateLoan(scenario)
  if (native.errors.length > 0) {
    return {
      kind: 'home',
      scenario,
      native,
      view: {
        primary: { id: 'standard-emi', label: 'Standard EMI', value: 0, format: 'currency' },
        metrics: [
          { id: 'loan-amount', label: 'Loan amount', value: Number.isFinite(native.loanAmount) ? native.loanAmount : 0, format: 'currency' },
          { id: 'total-interest', label: 'Total interest', value: 0, format: 'currency' },
          { id: 'payoff-date', label: 'Payoff date', value: scenario.startDate, format: 'date' },
        ],
        schedule: [],
        issues: native.issues,
        errors: native.errors,
        warnings: native.warnings,
      },
    }
  }
  const odByDate = new Map(native.od.schedule.map((row) => [row.date, row.netUtilized]))
  const schedule = native.standard.schedule.map<UnifiedScheduleRow>((row) => ({
    period: row.month,
    date: row.date,
    payment: row.emi,
    principal: row.principal,
    interest: row.interest,
    prepayment: row.prepayment,
    costs: row.ownershipCost,
    balance: row.balance,
    odNetUtilized: odByDate.get(row.date),
  }))
  return {
    kind: 'home',
    scenario,
    native,
    view: {
      primary: { id: 'standard-emi', label: 'Standard EMI', value: native.standard.initialEmi, format: 'currency' },
      metrics: [
        { id: 'loan-amount', label: 'Loan amount', value: native.loanAmount, format: 'currency' },
        { id: 'total-interest', label: 'Total interest', value: native.standard.totalInterest, format: 'currency' },
        { id: 'payoff-date', label: 'Payoff date', value: native.standard.payoffDate, format: 'date' },
      ],
      schedule,
      issues: native.issues,
      errors: native.errors,
      warnings: native.warnings,
    },
  }
}

export function calculateSuite(scenario: Extract<SuiteScenario, { kind: 'generic' }>): Extract<SuiteResult, { kind: 'generic' }>
export function calculateSuite(scenario: Extract<SuiteScenario, { kind: 'home' }>): Extract<SuiteResult, { kind: 'home' }>
export function calculateSuite(scenario: Extract<SuiteScenario, { kind: 'car' }>): Extract<SuiteResult, { kind: 'car' }>
export function calculateSuite(scenario: Extract<SuiteScenario, { kind: 'personal' }>): Extract<SuiteResult, { kind: 'personal' }>
export function calculateSuite(scenario: Extract<SuiteScenario, { kind: 'education' }>): Extract<SuiteResult, { kind: 'education' }>
export function calculateSuite(scenario: SuiteScenario): SuiteResult
export function calculateSuite(scenario: SuiteScenario): SuiteResult {
  switch (scenario.kind) {
    case 'generic': return calculateGeneric(scenario.value)
    case 'home': return calculateHomeAdapter(scenario.value)
    case 'car': return calculateCarAdapter(scenario.value)
    case 'personal': return calculatePersonalAdapter(scenario.value)
    case 'education': return calculateEducationAdapter(scenario.value)
  }
}
