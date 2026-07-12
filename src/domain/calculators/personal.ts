import { buildAmortizationSchedule } from '../amortization'
import { addMonths, cycleIndex, defaultScenario, roundMoney, toEpochDay } from '../loan'
import type { Prepayment, ValidationIssue } from '../loan'
import type { PersonalResult, PersonalScenario, UnifiedScheduleRow } from './types'

export const defaultPersonalScenario = (): PersonalScenario => ({
  principal: 500_000,
  quotedAnnualRate: 12,
  quotationMode: 'reducing',
  tenureMonths: 24,
  startDate: defaultScenario().startDate,
  processingFee: 0,
  processingFeeMode: 'amount',
  gstRate: 18,
  insuranceDeduction: 0,
  otherDeduction: 0,
  prepayments: [],
})

const solveApr = (netDisbursed: number, payments: number[]) => {
  const npv = (rate: number) => payments.reduce(
    (value, payment, index) => value - payment / ((1 + rate) ** (index + 1)),
    netDisbursed,
  )
  let low = 0
  let high = 0.5 / 12
  if (Math.abs(npv(0)) < 0.005) return 0
  if (npv(high) < 0) return 50
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (low + high) / 2
    const value = npv(middle)
    if (Math.abs(value) < 0.005) return middle * 1200
    if (value > 0) high = middle
    else low = middle
  }
  return ((low + high) / 2) * 1200
}

const prepaymentDue = (item: Prepayment, period: number, start: number) => {
  const delta = period - start
  if (delta < 0) return false
  const interval = item.frequency === 'once' ? 0
    : item.frequency === 'monthly' ? 1
      : item.frequency === 'quarterly' ? 3
        : 12
  return interval === 0 ? delta === 0 : delta % interval === 0
}

const flatSchedule = (scenario: PersonalScenario): UnifiedScheduleRow[] => {
  const totalInterest = roundMoney(
    scenario.principal * scenario.quotedAnnualRate / 100 * scenario.tenureMonths / 12,
  )
  const emi = roundMoney((scenario.principal + totalInterest) / scenario.tenureMonths)
  let balance = scenario.principal
  let postedInterest = 0
  const rows: UnifiedScheduleRow[] = []
  for (let index = 0; index < scenario.tenureMonths && balance > 0.005; index += 1) {
    const final = index === scenario.tenureMonths - 1
    const interest = final
      ? roundMoney(totalInterest - postedInterest)
      : roundMoney(totalInterest / scenario.tenureMonths)
    postedInterest = roundMoney(postedInterest + interest)
    const principal = final ? balance : roundMoney(Math.min(balance, emi - interest))
    const duePrepayment = roundMoney(scenario.prepayments
      .filter((item) => prepaymentDue(item, index, cycleIndex(scenario.startDate, item.date)!))
      .reduce((sum, item) => sum + item.amount, 0))
    const prepayment = roundMoney(Math.min(Math.max(0, balance - principal), duePrepayment))
    balance = roundMoney(Math.max(0, balance - principal - prepayment))
    rows.push({
      period: index + 1,
      date: addMonths(scenario.startDate, index),
      payment: roundMoney(principal + interest),
      principal,
      interest,
      prepayment,
      costs: 0,
      balance,
    })
  }
  return rows
}

const emptyResult = (
  scenario: PersonalScenario,
  issues: ValidationIssue[],
  values: Partial<Pick<PersonalResult,
    'processingFeeAmount' | 'gstAmount' | 'totalDeductions' | 'netDisbursed'>> = {},
): PersonalResult => ({
  quotedAnnualRate: Number.isFinite(scenario?.quotedAnnualRate) ? scenario.quotedAnnualRate : 0,
  effectiveApr: 0,
  processingFeeAmount: Number.isFinite(values.processingFeeAmount) ? values.processingFeeAmount! : 0,
  gstAmount: Number.isFinite(values.gstAmount) ? values.gstAmount! : 0,
  insuranceDeduction: Number.isFinite(scenario?.insuranceDeduction) ? scenario.insuranceDeduction : 0,
  otherDeduction: Number.isFinite(scenario?.otherDeduction) ? scenario.otherDeduction : 0,
  totalDeductions: Number.isFinite(values.totalDeductions) ? values.totalDeductions! : 0,
  netDisbursed: Number.isFinite(values.netDisbursed) ? values.netDisbursed! : 0,
  initialEmi: 0,
  totalInterest: 0,
  totalRepayment: 0,
  payoffDate: typeof scenario?.startDate === 'string' ? scenario.startDate : '',
  schedule: [],
  issues,
  errors: issues.map(({ message }) => message),
  warnings: [],
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const validatePersonal = (scenario: PersonalScenario) => {
  const issues: ValidationIssue[] = []
  const add = (field: string, message: string) => issues.push({ field, message })
  const money = (field: 'principal' | 'insuranceDeduction' | 'otherDeduction', positive = false) => {
    const value = scenario?.[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000 || (positive && value === 0)) {
      add(field, `${field} must be ${positive ? 'above ₹0' : 'between ₹0'} and ₹100 crore.`)
    }
  }
  money('principal', true)
  money('insuranceDeduction')
  money('otherDeduction')
  if (!Number.isFinite(scenario?.quotedAnnualRate) || scenario.quotedAnnualRate < 0 || scenario.quotedAnnualRate > 50) add('quotedAnnualRate', 'Quoted rate must be between 0% and 50%.')
  if (scenario?.quotationMode !== 'reducing' && scenario?.quotationMode !== 'flat') add('quotationMode', 'Quotation mode must be reducing or flat.')
  if (!Number.isInteger(scenario?.tenureMonths) || scenario.tenureMonths < 1 || scenario.tenureMonths > 480) add('tenureMonths', 'Tenure must be between 1 and 480 months.')
  if (typeof scenario?.startDate !== 'string' || !Number.isFinite(toEpochDay(scenario.startDate))) add('startDate', 'Start date must be a valid calendar date.')
  if (scenario?.processingFeeMode !== 'amount' && scenario?.processingFeeMode !== 'percent') add('processingFeeMode', 'Processing fee mode must be amount or percent.')
  const feeMax = scenario?.processingFeeMode === 'percent' ? 100 : 1_000_000_000
  if (!Number.isFinite(scenario?.processingFee) || scenario.processingFee < 0 || scenario.processingFee > feeMax) add('processingFee', `Processing fee must be between 0 and ${feeMax}.`)
  if (!Number.isFinite(scenario?.gstRate) || scenario.gstRate < 0 || scenario.gstRate > 100) add('gstRate', 'GST rate must be between 0% and 100%.')

  const value: unknown = scenario?.prepayments
  const prepayments: unknown[] = Array.isArray(value) ? value : []
  if (!Array.isArray(value)) add('prepayments', 'Prepayments must be a list.')
  if (prepayments.length > 100) add('prepayments', 'Prepayments are limited to 100 entries.')
  const ids = prepayments.filter(isRecord).map(({ id }) => id)
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
  if (new Set(ids).size !== ids.length) add('prepayments', 'Prepayment IDs must be unique.')
  const itemField = (id: unknown, index: number, field: string) =>
    `prepayments.${typeof id === 'string' && id.trim() ? id : index}.${field}`
  prepayments.forEach((item, index) => {
    if (!isRecord(item)) {
      add(`prepayments.${index}`, 'Prepayment entry must be an object.')
      return
    }
    if (typeof item.id !== 'string' || !item.id.trim()) add(itemField(item.id, index, 'id'), 'Prepayment IDs must not be blank.')
    const cycle = typeof item.date === 'string' && typeof scenario?.startDate === 'string'
      ? cycleIndex(scenario.startDate, item.date) : null
    if (cycle === null || cycle >= scenario.tenureMonths) add(itemField(item.id, index, 'date'), 'Prepayment must fall on an EMI date within the loan tenure.')
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 0 || item.amount > 1_000_000_000) add(itemField(item.id, index, 'amount'), 'Prepayment must be between ₹0 and ₹100 crore.')
    if (item.frequency !== 'once' && item.frequency !== 'monthly' && item.frequency !== 'quarterly' && item.frequency !== 'yearly') add(itemField(item.id, index, 'frequency'), 'Prepayment frequency is invalid.')
  })
  return issues
}

export const calculatePersonal = (scenario: PersonalScenario): PersonalResult => {
  const issues = validatePersonal(scenario)
  if (issues.length > 0) return emptyResult(scenario, issues)
  const processingFeeAmount = scenario.processingFeeMode === 'percent'
    ? roundMoney(scenario.principal * scenario.processingFee / 100)
    : scenario.processingFee
  const gstAmount = roundMoney(processingFeeAmount * scenario.gstRate / 100)
  const totalDeductions = roundMoney(
    processingFeeAmount + gstAmount + scenario.insuranceDeduction + scenario.otherDeduction,
  )
  const netDisbursed = roundMoney(scenario.principal - totalDeductions)
  if (netDisbursed <= 0) {
    return emptyResult(scenario, [{ field: 'netDisbursed', message: 'Upfront deductions must be below the requested principal.' }], {
      processingFeeAmount, gstAmount, totalDeductions, netDisbursed,
    })
  }
  const warnings: string[] = []
  let schedule: UnifiedScheduleRow[]

  if (scenario.quotationMode === 'flat') {
    schedule = flatSchedule(scenario)
  } else {
    const engineStartDate = addMonths(scenario.startDate, -1)
    const result = buildAmortizationSchedule({
      principal: scenario.principal,
      annualRate: scenario.quotedAnnualRate,
      tenureMonths: scenario.tenureMonths,
      startDate: engineStartDate,
      prepayments: scenario.prepayments.map((item) => ({
        ...item,
        date: addMonths(engineStartDate, (cycleIndex(scenario.startDate, item.date) ?? -1) + 1),
      })),
      rateChanges: [],
      balloonAmount: 0,
    })
    warnings.push(...result.warnings)
    schedule = result.rows.map((row) => ({
      period: row.month,
      date: addMonths(scenario.startDate, row.month - 1),
      payment: row.emi,
      principal: row.principal,
      interest: row.interest,
      prepayment: row.prepayment,
      costs: 0,
      balance: row.balance,
    }))
  }

  const totalInterest = roundMoney(schedule.reduce((sum, row) => sum + row.interest, 0))
  const postPayoffIssues = scenario.prepayments.flatMap((item, index) =>
    (cycleIndex(scenario.startDate, item.date) ?? -1) >= schedule.length
      ? [{ field: `prepayments.${item.id || index}.date`, message: 'Prepayment must not be after the loan payoff date.' }]
      : [])
  if (postPayoffIssues.length > 0) return emptyResult(scenario, postPayoffIssues, {
    processingFeeAmount, gstAmount, totalDeductions, netDisbursed,
  })
  const totalRepayment = roundMoney(schedule.reduce((sum, row) => sum + row.payment + row.prepayment, 0))
  const payments = schedule.map((row) => roundMoney(row.payment + row.prepayment))
  return {
    quotedAnnualRate: scenario.quotedAnnualRate,
    effectiveApr: solveApr(netDisbursed, payments),
    processingFeeAmount,
    gstAmount,
    insuranceDeduction: scenario.insuranceDeduction,
    otherDeduction: scenario.otherDeduction,
    totalDeductions,
    netDisbursed,
    initialEmi: schedule[0]?.payment ?? 0,
    totalInterest,
    totalRepayment,
    payoffDate: schedule.at(-1)?.date ?? scenario.startDate,
    schedule,
    issues: [],
    errors: [],
    warnings,
  }
}
