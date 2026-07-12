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

export interface CarScenario {
  vehiclePrice: number
  downPayment: number
  downPaymentMode: 'amount' | 'percent'
  registrationFees: number
  financeRegistrationFees: boolean
  financedInsurance: number
  annualRate: number
  tenureMonths: number
  startDate: string
  processingFee: number
  balloonAmount: number
  expectedResaleValue: number
  ownershipMonths: number
  prepayments: Prepayment[]
  rateChanges: RateChange[]
}

export interface CarResult {
  financedPrincipal: number
  downPaymentAmount: number
  initialEmi: number
  balloonAmount: number
  totalInterest: number
  cashOutflowThroughHorizon: number
  remainingLoanSettlement: number
  netOwnershipCost: number
  payoffDate: string
  schedule: UnifiedScheduleRow[]
  issues: ValidationIssue[]
  errors: string[]
  warnings: string[]
}

export interface PersonalScenario {
  principal: number
  quotedAnnualRate: number
  quotationMode: 'reducing' | 'flat'
  tenureMonths: number
  startDate: string
  processingFee: number
  processingFeeMode: 'amount' | 'percent'
  gstRate: number
  insuranceDeduction: number
  otherDeduction: number
  prepayments: Prepayment[]
}

export interface PersonalResult {
  quotedAnnualRate: number
  effectiveApr: number
  processingFeeAmount: number
  gstAmount: number
  insuranceDeduction: number
  otherDeduction: number
  totalDeductions: number
  netDisbursed: number
  initialEmi: number
  totalInterest: number
  totalRepayment: number
  payoffDate: string
  schedule: UnifiedScheduleRow[]
  issues: ValidationIssue[]
  errors: string[]
  warnings: string[]
}

export interface EducationDisbursement {
  id: string
  date: string
  amount: number
}

export interface EducationScenario {
  courseCost: number
  ownContribution: number
  disbursements: EducationDisbursement[]
  studyAnnualRate: number
  studyMonths: number
  moratoriumMonths: number
  servicingMode: 'none' | 'full-interest' | 'fixed-monthly'
  servicingAmount: number
  repaymentAnnualRate: number
  repaymentTenureMonths: number
  startDate: string
  processingFee: number
  prepayments: Prepayment[]
}

export interface EducationPhaseRow {
  date: string
  phase: 'study' | 'moratorium' | 'repayment-start'
  disbursement: number
  payment: number
  outstandingPrincipal: number
  accruedInterest: number
}

export interface EducationResult {
  totalDisbursed: number
  servicedInterest: number
  capitalizedInterest: number
  repaymentPrincipal: number
  initialEmi: number
  repaymentInterest: number
  totalCost: number
  repaymentStartDate: string
  payoffDate: string
  phaseRows: EducationPhaseRow[]
  schedule: UnifiedScheduleRow[]
  issues: ValidationIssue[]
  errors: string[]
  warnings: string[]
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
  | { kind: 'car'; value: CarScenario }
  | { kind: 'personal'; value: PersonalScenario }
  | { kind: 'education'; value: EducationScenario }

export type SuiteResult =
  | { kind: 'generic'; scenario: GenericScenario; view: UnifiedViewResult; native: import('./generic').GenericResult }
  | { kind: 'home'; scenario: LoanScenario; view: UnifiedViewResult; native: CalculationResult }
  | { kind: 'car'; scenario: CarScenario; view: UnifiedViewResult; native: CarResult }
  | { kind: 'personal'; scenario: PersonalScenario; view: UnifiedViewResult; native: PersonalResult }
  | { kind: 'education'; scenario: EducationScenario; view: UnifiedViewResult; native: EducationResult }
