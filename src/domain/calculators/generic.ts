import { buildAmortizationSchedule } from '../amortization'
import {
  addMonths,
  cycleIndex,
  defaultScenario,
  roundMoney,
  toEpochDay,
  type ValidationIssue,
} from '../loan'
import type { GenericScenario, SuiteResult, UnifiedScheduleRow, UnifiedViewResult } from './types'

const MAX_MONEY = 1_000_000_000
const MAX_EVENTS = 100

export interface GenericResult {
  initialEmi: number
  totalInterest: number
  totalRepayment: number
  payoffDate: string
  schedule: UnifiedScheduleRow[]
}

export const defaultGenericScenario = (): GenericScenario => ({
  principal: 1_000_000,
  annualRate: 10,
  tenureMonths: 60,
  startDate: defaultScenario().startDate,
  processingFee: 0,
  prepayments: [],
  rateChanges: [],
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const duplicates = (values: string[]) => new Set(values).size !== values.length

const validateGeneric = (scenario: GenericScenario): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  const add = (field: string, message: string) => issues.push({ field, message })
  const itemField = (list: string, id: unknown, index: number, field: string) =>
    `${list}.${typeof id === 'string' && id.trim() ? id : index}.${field}`
  const validCycle = (date: unknown) => typeof date === 'string'
    && cycleIndex(scenario.startDate, date) !== null

  if (!Number.isFinite(scenario.principal) || scenario.principal <= 0 || scenario.principal > MAX_MONEY) {
    add('principal', 'Principal must be above ₹0 and at most ₹100 crore.')
  }
  if (!Number.isFinite(scenario.annualRate) || scenario.annualRate < 0 || scenario.annualRate > 50) {
    add('annualRate', 'Interest rate must be between 0% and 50%.')
  }
  if (!Number.isInteger(scenario.tenureMonths) || scenario.tenureMonths < 1 || scenario.tenureMonths > 480) {
    add('tenureMonths', 'Tenure must be between 1 and 480 months.')
  }
  if (!Number.isFinite(toEpochDay(scenario.startDate))) {
    add('startDate', 'Start date must be a valid calendar date.')
  }
  if (!Number.isFinite(scenario.processingFee) || scenario.processingFee < 0 || scenario.processingFee > MAX_MONEY) {
    add('processingFee', 'Processing fee must be between ₹0 and ₹100 crore.')
  }

  const prepaymentsValue: unknown = scenario.prepayments
  const prepayments: unknown[] = Array.isArray(prepaymentsValue) ? prepaymentsValue : []
  if (!Array.isArray(prepaymentsValue)) add('prepayments', 'Prepayments must be a list.')
  const validPrepayments = prepayments.filter(isRecord)
  const prepaymentIds = validPrepayments
    .map(({ id }) => id)
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
  if (prepayments.length > MAX_EVENTS) add('prepayments', 'Prepayments are limited to 100 entries.')
  if (duplicates(prepaymentIds)) add('prepayments', 'Prepayment IDs must be unique.')
  prepayments.forEach((item, index) => {
    if (!isRecord(item)) {
      add(`prepayments.${index}`, 'Prepayment entry must be an object.')
      return
    }
    if (typeof item.id !== 'string' || !item.id.trim()) {
      add(itemField('prepayments', item.id, index, 'id'), 'Prepayment IDs must not be blank.')
    }
    if (!validCycle(item.date)) {
      add(itemField('prepayments', item.id, index, 'date'), 'Prepayment must fall on an EMI date on or after the first EMI date.')
    }
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 0 || item.amount > MAX_MONEY) {
      add(itemField('prepayments', item.id, index, 'amount'), 'Prepayment must be between ₹0 and ₹100 crore.')
    }
    if (item.frequency !== 'once' && item.frequency !== 'monthly'
      && item.frequency !== 'quarterly' && item.frequency !== 'yearly') {
      add(itemField('prepayments', item.id, index, 'frequency'), 'Prepayment frequency is invalid.')
    }
  })

  const rateChangesValue: unknown = scenario.rateChanges
  const rateChanges: unknown[] = Array.isArray(rateChangesValue) ? rateChangesValue : []
  if (!Array.isArray(rateChangesValue)) add('rateChanges', 'Rate changes must be a list.')
  const validRateChanges = rateChanges.filter(isRecord)
  const rateIds = validRateChanges
    .map(({ id }) => id)
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
  if (rateChanges.length > MAX_EVENTS) add('rateChanges', 'Rate changes are limited to 100 entries.')
  if (duplicates(rateIds)) add('rateChanges', 'Rate-change IDs must be unique.')
  rateChanges.forEach((change, index) => {
    if (!isRecord(change)) {
      add(`rateChanges.${index}`, 'Rate change entry must be an object.')
      return
    }
    if (typeof change.id !== 'string' || !change.id.trim()) {
      add(itemField('rateChanges', change.id, index, 'id'), 'Rate-change IDs must not be blank.')
    }
    if (!validCycle(change.date)) {
      add(itemField('rateChanges', change.id, index, 'date'), 'Rate change must fall on an EMI date on or after the first EMI date.')
    }
    if (typeof change.annualRate !== 'number' || !Number.isFinite(change.annualRate)
      || change.annualRate < 0 || change.annualRate > 50) {
      add(itemField('rateChanges', change.id, index, 'annualRate'), 'Changed rate must be between 0% and 50%.')
    }
    if (change.mode !== 'keep-emi' && change.mode !== 'keep-tenure') {
      add(itemField('rateChanges', change.id, index, 'mode'), 'Rate-change mode must be keep-emi or keep-tenure.')
    }
  })
  const rateDates = validRateChanges.map(({ date }) => date).filter((date): date is string => validCycle(date))
  new Set(rateDates.filter((date, index) => rateDates.indexOf(date) !== index)).forEach((date) => {
    add('rateChanges', `Only one rate change may apply on ${date}.`)
  })

  return issues
}

const emptyView = (
  scenario: GenericScenario,
  issues: ValidationIssue[],
  warnings: string[] = [],
): UnifiedViewResult => ({
  primary: { id: 'monthly-emi', label: 'Monthly EMI', value: 0, format: 'currency' },
  metrics: [
    { id: 'principal', label: 'Principal', value: Number.isFinite(scenario.principal) ? scenario.principal : 0, format: 'currency' },
    { id: 'total-interest', label: 'Total interest', value: 0, format: 'currency' },
    { id: 'total-repayment', label: 'Total repayment', value: 0, format: 'currency' },
    { id: 'payoff-date', label: 'Payoff date', value: scenario.startDate, format: 'date' },
    { id: 'processing-fee', label: 'Processing fee', value: Number.isFinite(scenario.processingFee) ? scenario.processingFee : 0, format: 'currency' },
  ],
  schedule: [],
  issues,
  errors: issues.map(({ message }) => message),
  warnings,
})

const blockingResult = (
  scenario: GenericScenario,
  issues: ValidationIssue[],
  warnings: string[] = [],
): Extract<SuiteResult, { kind: 'generic' }> => {
  const view = emptyView(scenario, issues, warnings)
  return {
    kind: 'generic',
    scenario,
    view,
    native: { initialEmi: 0, totalInterest: 0, totalRepayment: 0, payoffDate: scenario.startDate, schedule: [] },
  }
}

export const calculateGeneric = (scenario: GenericScenario): Extract<SuiteResult, { kind: 'generic' }> => {
  const validationIssues = validateGeneric(scenario)
  if (validationIssues.length > 0) return blockingResult(scenario, validationIssues)

  const engineStartDate = addMonths(scenario.startDate, -1)
  const engineRateDates = new Map<string, string>()
  const amortization = buildAmortizationSchedule({
    ...scenario,
    startDate: engineStartDate,
    prepayments: scenario.prepayments.map((prepayment) => ({
      ...prepayment,
      date: addMonths(engineStartDate, cycleIndex(scenario.startDate, prepayment.date)! + 1),
    })),
    rateChanges: scenario.rateChanges.map((change) => {
      const date = addMonths(engineStartDate, cycleIndex(scenario.startDate, change.date)!)
      engineRateDates.set(date, change.date)
      return { ...change, date }
    }),
    balloonAmount: 0,
  })
  const engineErrors = amortization.errors.map((message) => {
    let publicMessage = message
    engineRateDates.forEach((publicDate, engineDate) => {
      publicMessage = publicMessage.replace(engineDate, publicDate)
    })
    return publicMessage
  })
  if (amortization.errors.length > 0) {
    return blockingResult(
      scenario,
      engineErrors.map((message) => ({ field: 'scenario', message })),
      amortization.warnings,
    )
  }
  const schedule = amortization.rows.map<UnifiedScheduleRow>((row) => ({
    period: row.month,
    date: addMonths(scenario.startDate, row.month - 1),
    payment: row.emi,
    principal: row.principal,
    interest: row.interest,
    prepayment: row.prepayment,
    costs: 0,
    balance: row.balance,
  }))
  const totalInterest = roundMoney(amortization.totalInterest)
  const totalRepayment = roundMoney(scenario.principal + totalInterest + scenario.processingFee)
  const native: GenericResult = {
    initialEmi: amortization.initialEmi,
    totalInterest,
    totalRepayment,
    payoffDate: schedule.at(-1)?.date ?? scenario.startDate,
    schedule,
  }
  return {
    kind: 'generic',
    scenario,
    native,
    view: {
      primary: { id: 'monthly-emi', label: 'Monthly EMI', value: native.initialEmi, format: 'currency' },
      metrics: [
        { id: 'principal', label: 'Principal', value: scenario.principal, format: 'currency' },
        { id: 'total-interest', label: 'Total interest', value: totalInterest, format: 'currency' },
        { id: 'total-repayment', label: 'Total repayment', value: totalRepayment, format: 'currency' },
        { id: 'payoff-date', label: 'Payoff date', value: native.payoffDate, format: 'date' },
        { id: 'processing-fee', label: 'Processing fee', value: scenario.processingFee, format: 'currency' },
      ],
      schedule,
      issues: [],
      errors: [],
      warnings: amortization.warnings,
    },
  }
}
