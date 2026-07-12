import { calculateLoan, defaultScenario, type LoanScenario } from '../loan'
import { calculateGeneric, defaultGenericScenario } from './generic'
import type { GenericScenario, SuiteResult, SuiteScenario, UnifiedScheduleRow } from './types'

export type * from './types'
export { calculateGeneric, defaultGenericScenario } from './generic'
export type { GenericResult } from './generic'

export function defaultSuiteScenario(kind: 'generic'): { kind: 'generic'; value: GenericScenario }
export function defaultSuiteScenario(kind: 'home'): { kind: 'home'; value: LoanScenario }
export function defaultSuiteScenario(kind: 'generic' | 'home'): SuiteScenario {
  switch (kind) {
    case 'generic': return { kind, value: defaultGenericScenario() }
    case 'home': return { kind, value: defaultScenario() }
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
export function calculateSuite(scenario: SuiteScenario): SuiteResult
export function calculateSuite(scenario: SuiteScenario): SuiteResult {
  switch (scenario.kind) {
    case 'generic': return calculateGeneric(scenario.value)
    case 'home': return calculateHomeAdapter(scenario.value)
  }
}
