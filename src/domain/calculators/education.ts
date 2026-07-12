import { buildAmortizationSchedule } from '../amortization'
import { addMonths, cycleIndex, defaultScenario, fromEpochDay, roundMoney, toEpochDay } from '../loan'
import type { ValidationIssue } from '../loan'
import type {
  EducationPhaseRow,
  EducationResult,
  EducationScenario,
  UnifiedScheduleRow,
} from './types'

export const defaultEducationScenario = (): EducationScenario => {
  const startDate = defaultScenario().startDate
  return {
    courseCost: 1_000_000,
    ownContribution: 200_000,
    disbursements: [{ id: 'course', date: startDate, amount: 800_000 }],
    studyAnnualRate: 10,
    studyMonths: 24,
    moratoriumMonths: 6,
    servicingMode: 'none',
    servicingAmount: 0,
    repaymentAnnualRate: 11,
    repaymentTenureMonths: 120,
    startDate,
    processingFee: 0,
    prepayments: [],
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const emptyResult = (scenario: EducationScenario, issues: ValidationIssue[]): EducationResult => ({
  totalDisbursed: 0,
  servicedInterest: 0,
  capitalizedInterest: 0,
  repaymentPrincipal: 0,
  initialEmi: 0,
  repaymentInterest: 0,
  totalCost: 0,
  repaymentStartDate: typeof scenario?.startDate === 'string' ? scenario.startDate : '',
  payoffDate: typeof scenario?.startDate === 'string' ? scenario.startDate : '',
  phaseRows: [],
  schedule: [],
  issues,
  errors: issues.map(({ message }) => message),
  warnings: [],
})

const validateEducation = (scenario: EducationScenario) => {
  const issues: ValidationIssue[] = []
  const add = (field: string, message: string) => issues.push({ field, message })
  const money = (field: 'courseCost' | 'ownContribution' | 'servicingAmount' | 'processingFee', positive = false) => {
    const value = scenario?.[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000 || (positive && value === 0)) {
      add(field, `${field} must be ${positive ? 'above ₹0' : 'between ₹0'} and ₹100 crore.`)
    }
  }
  money('courseCost', true)
  money('ownContribution')
  money('servicingAmount')
  money('processingFee')
  if (Number.isFinite(scenario?.courseCost) && Number.isFinite(scenario?.ownContribution) && scenario.ownContribution > scenario.courseCost) add('ownContribution', 'Own contribution cannot exceed course cost.')
  if (!Number.isFinite(scenario?.studyAnnualRate) || scenario.studyAnnualRate < 0 || scenario.studyAnnualRate > 50) add('studyAnnualRate', 'Study-period rate must be between 0% and 50%.')
  if (!Number.isInteger(scenario?.studyMonths) || scenario.studyMonths < 1 || scenario.studyMonths > 120) add('studyMonths', 'Study period must be between 1 and 120 months.')
  if (!Number.isInteger(scenario?.moratoriumMonths) || scenario.moratoriumMonths < 0 || scenario.moratoriumMonths > 60) add('moratoriumMonths', 'Moratorium must be between 0 and 60 months.')
  if (scenario?.servicingMode !== 'none' && scenario?.servicingMode !== 'full-interest' && scenario?.servicingMode !== 'fixed-monthly') add('servicingMode', 'Servicing mode is invalid.')
  if (scenario?.servicingMode === 'fixed-monthly' && scenario.servicingAmount <= 0) add('servicingAmount', 'Fixed monthly servicing must be above ₹0.')
  if (!Number.isFinite(scenario?.repaymentAnnualRate) || scenario.repaymentAnnualRate < 0 || scenario.repaymentAnnualRate > 50) add('repaymentAnnualRate', 'Repayment rate must be between 0% and 50%.')
  if (!Number.isInteger(scenario?.repaymentTenureMonths) || scenario.repaymentTenureMonths < 1 || scenario.repaymentTenureMonths > 480) add('repaymentTenureMonths', 'Repayment tenure must be between 1 and 480 months.')
  const validStart = typeof scenario?.startDate === 'string' && Number.isFinite(toEpochDay(scenario.startDate))
  if (!validStart) add('startDate', 'Start date must be a valid calendar date.')
  const repaymentStartDate = validStart && Number.isInteger(scenario?.studyMonths) && Number.isInteger(scenario?.moratoriumMonths)
    ? addMonths(scenario.startDate, scenario.studyMonths + scenario.moratoriumMonths) : ''

  const disbursementValue: unknown = scenario?.disbursements
  const disbursements: unknown[] = Array.isArray(disbursementValue) ? disbursementValue : []
  if (!Array.isArray(disbursementValue)) add('disbursements', 'Disbursements must be a list.')
  if (disbursements.length < 1 || disbursements.length > 100) add('disbursements', 'Provide between 1 and 100 disbursements.')
  const ids = disbursements.filter(isRecord).map(({ id }) => id)
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
  if (new Set(ids).size !== ids.length) add('disbursements', 'Disbursement IDs must be unique.')
  let previousDay = Number.NEGATIVE_INFINITY
  let totalDisbursed = 0
  disbursements.forEach((item, index) => {
    if (!isRecord(item)) {
      add(`disbursements.${index}`, 'Disbursement entry must be an object.')
      return
    }
    if (typeof item.id !== 'string' || !item.id.trim()) add(`disbursements.${index}.id`, 'Disbursement IDs must not be blank.')
    const day = typeof item.date === 'string' ? toEpochDay(item.date) : Number.NaN
    if (!Number.isFinite(day) || !validStart || day < toEpochDay(scenario.startDate) || day >= toEpochDay(repaymentStartDate)) {
      add(`disbursements.${index}.date`, 'Disbursement date must fall before repayment starts.')
    } else if (day < previousDay) {
      add(`disbursements.${index}.date`, 'Disbursements must be ordered by date.')
    }
    if (Number.isFinite(day)) previousDay = day
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > 1_000_000_000) {
      add(`disbursements.${index}.amount`, 'Disbursement must be above ₹0 and at most ₹100 crore.')
    } else totalDisbursed += item.amount
  })
  if (Number.isFinite(scenario?.courseCost) && Number.isFinite(scenario?.ownContribution)
    && totalDisbursed > scenario.courseCost - scenario.ownContribution + 0.005) {
    add('totalDisbursed', 'Total disbursements cannot exceed course cost minus own contribution.')
  }

  const prepaymentValue: unknown = scenario?.prepayments
  const prepayments: unknown[] = Array.isArray(prepaymentValue) ? prepaymentValue : []
  if (!Array.isArray(prepaymentValue)) add('prepayments', 'Prepayments must be a list.')
  if (prepayments.length > 100) add('prepayments', 'Prepayments are limited to 100 entries.')
  const prepaymentIds = prepayments.filter(isRecord).map(({ id }) => id)
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
  if (new Set(prepaymentIds).size !== prepaymentIds.length) add('prepayments', 'Prepayment IDs must be unique.')
  prepayments.forEach((item, index) => {
    if (!isRecord(item)) {
      add(`prepayments.${index}`, 'Prepayment entry must be an object.')
      return
    }
    const key = typeof item.id === 'string' && item.id.trim() ? item.id : index
    if (typeof item.id !== 'string' || !item.id.trim()) add(`prepayments.${key}.id`, 'Prepayment IDs must not be blank.')
    const cycle = typeof item.date === 'string' && repaymentStartDate
      ? cycleIndex(repaymentStartDate, item.date) : null
    if (cycle === null || cycle >= scenario.repaymentTenureMonths) add(`prepayments.${key}.date`, 'Prepayment must fall on an EMI date within the repayment tenure.')
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 0 || item.amount > 1_000_000_000) add(`prepayments.${key}.amount`, 'Prepayment must be between ₹0 and ₹100 crore.')
    if (item.frequency !== 'once' && item.frequency !== 'monthly' && item.frequency !== 'quarterly' && item.frequency !== 'yearly') add(`prepayments.${key}.frequency`, 'Prepayment frequency is invalid.')
  })
  return issues
}

const studyLedger = (scenario: EducationScenario) => {
  const startDay = toEpochDay(scenario.startDate)
  const studyEnd = addMonths(scenario.startDate, scenario.studyMonths)
  const repaymentStartDate = addMonths(studyEnd, scenario.moratoriumMonths)
  const repaymentDay = toEpochDay(repaymentStartDate)
  const disbursements = new Map<string, number>()
  scenario.disbursements.forEach(({ date, amount }) => {
    disbursements.set(date, roundMoney((disbursements.get(date) ?? 0) + amount))
  })
  const servicingDates = new Set(Array.from(
    { length: scenario.studyMonths + scenario.moratoriumMonths + 1 },
    (_, index) => addMonths(scenario.startDate, index),
  ))
  const phaseRows: EducationPhaseRow[] = []
  let outstandingPrincipal = 0
  let accruedInterest = 0
  let servicedInterest = 0

  for (let day = startDay; day <= repaymentDay; day += 1) {
    const date = fromEpochDay(day)
    const disbursement = disbursements.get(date) ?? 0
    outstandingPrincipal = roundMoney(outstandingPrincipal + disbursement)
    let payment = 0
    if (servicingDates.has(date)) {
      payment = scenario.servicingMode === 'full-interest'
        ? roundMoney(accruedInterest)
        : scenario.servicingMode === 'fixed-monthly'
          ? Math.min(roundMoney(accruedInterest), scenario.servicingAmount)
          : 0
      accruedInterest = Math.max(0, accruedInterest - payment)
      servicedInterest = roundMoney(servicedInterest + payment)
    }
    if (day < repaymentDay) {
      accruedInterest += outstandingPrincipal * scenario.studyAnnualRate / 100 / 365
    }
    if (disbursement > 0 || servicingDates.has(date)) {
      phaseRows.push({
        date,
        phase: day >= repaymentDay ? 'repayment-start'
          : date >= studyEnd ? 'moratorium' : 'study',
        disbursement,
        payment,
        outstandingPrincipal,
        accruedInterest: roundMoney(accruedInterest),
      })
    }
  }
  return {
    repaymentStartDate,
    phaseRows,
    servicedInterest,
    capitalizedInterest: Math.max(0, roundMoney(accruedInterest)),
  }
}

export const calculateEducation = (scenario: EducationScenario): EducationResult => {
  const issues = validateEducation(scenario)
  if (issues.length > 0) return emptyResult(scenario, issues)
  const totalDisbursed = roundMoney(scenario.disbursements.reduce((sum, item) => sum + item.amount, 0))
  const ledger = studyLedger(scenario)
  const repaymentPrincipal = roundMoney(totalDisbursed + ledger.capitalizedInterest)
  if (repaymentPrincipal <= 0 || repaymentPrincipal > 1_000_000_000) {
    return emptyResult(scenario, [{ field: 'repaymentPrincipal', message: 'Repayment principal must be above ₹0 and at most ₹100 crore.' }])
  }
  const engineStartDate = addMonths(ledger.repaymentStartDate, -1)
  const amortization = buildAmortizationSchedule({
    principal: repaymentPrincipal,
    annualRate: scenario.repaymentAnnualRate,
    tenureMonths: scenario.repaymentTenureMonths,
    startDate: engineStartDate,
    prepayments: scenario.prepayments.map((item) => ({
      ...item,
      date: addMonths(engineStartDate, (cycleIndex(ledger.repaymentStartDate, item.date) ?? -1) + 1),
    })),
    rateChanges: [],
    balloonAmount: 0,
  })
  const schedule = amortization.rows.map<UnifiedScheduleRow>((row) => ({
    period: row.month,
    date: addMonths(ledger.repaymentStartDate, row.month - 1),
    payment: row.emi,
    principal: row.principal,
    interest: row.interest,
    prepayment: row.prepayment,
    costs: 0,
    balance: row.balance,
  }))
  if (amortization.errors.length > 0) {
    return emptyResult(scenario, amortization.errors.map((message) => ({ field: 'scenario', message })))
  }
  const latePrepayments = scenario.prepayments.flatMap((item, index) =>
    (cycleIndex(ledger.repaymentStartDate, item.date) ?? -1) >= schedule.length
      ? [{ field: `prepayments.${item.id || index}.date`, message: 'Prepayment must not be after the loan payoff date.' }]
      : [])
  if (latePrepayments.length > 0) return emptyResult(scenario, latePrepayments)
  const repaymentInterest = roundMoney(amortization.totalInterest)
  return {
    totalDisbursed,
    servicedInterest: ledger.servicedInterest,
    capitalizedInterest: ledger.capitalizedInterest,
    repaymentPrincipal,
    initialEmi: schedule[0]?.payment ?? amortization.initialEmi,
    repaymentInterest,
    totalCost: roundMoney(scenario.processingFee + ledger.servicedInterest + repaymentPrincipal + repaymentInterest),
    repaymentStartDate: ledger.repaymentStartDate,
    payoffDate: schedule.at(-1)?.date ?? ledger.repaymentStartDate,
    phaseRows: ledger.phaseRows,
    schedule,
    issues: [],
    errors: amortization.errors,
    warnings: amortization.warnings,
  }
}
