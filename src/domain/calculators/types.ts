import type {
  CalculationResult,
  LoanScenario,
  Prepayment,
  RateChange,
  ValidationIssue,
} from '../loan'

export type CalculatorKind = 'generic' | 'home' | 'car' | 'personal' | 'education'
export type SolverKind = 'affordability' | 'prepayment' | 'tenure' | 'interest-rate'

export interface GenericScenario {
  principal: number
  annualRate: number
  tenureMonths: number
  startDate: string
  processingFee: number
  prepayments: Prepayment[]
  rateChanges: RateChange[]
}

export interface ViewMetric {
  id: string
  label: string
  value: number | string
  format: 'currency' | 'percentage' | 'date' | 'number' | 'text'
}

export interface UnifiedScheduleRow {
  period: number
  date: string
  payment: number
  principal: number
  interest: number
  prepayment: number
  costs: number
  balance: number
  odNetUtilized?: number
}

export interface UnifiedViewResult {
  primary: ViewMetric
  metrics: ViewMetric[]
  schedule: UnifiedScheduleRow[]
  issues: ValidationIssue[]
  errors: string[]
  warnings: string[]
}

export type SuiteScenario =
  | { kind: 'generic'; value: GenericScenario }
  | { kind: 'home'; value: LoanScenario }

export type SuiteResult =
  | { kind: 'generic'; scenario: GenericScenario; view: UnifiedViewResult; native: import('./generic').GenericResult }
  | { kind: 'home'; scenario: LoanScenario; view: UnifiedViewResult; native: CalculationResult }
