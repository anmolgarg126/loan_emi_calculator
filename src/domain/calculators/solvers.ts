import { addMonths, buildAmortizationSchedule, calculateEmi, cycleIndex, roundMoney } from '../amortization'
import type { Prepayment, RateChange } from '../loan'
import { calculateGeneric, type GenericResult } from './generic'
import type { GenericScenario, UnifiedScheduleRow } from './types'

const MAX_MONEY = 1_000_000_000

export interface AffordablePrincipalInput {
  emi: number
  annualRate: number
  tenureMonths: number
}

export interface TenureSolverInput {
  principal: number
  annualRate: number
  emi: number
}

export interface AnnualRateSolverInput {
  principal: number
  emi: number
  tenureMonths: number
}

export type PrepaymentMode = 'keep-emi' | 'keep-tenure'

export interface PrepaymentComparisonInput {
  scenario: GenericScenario
  prepayments: Prepayment[]
  mode: PrepaymentMode
}

export interface PrepaymentComparisonResult {
  baseline: GenericResult
  modified: GenericResult
  interestSaved: number
  monthsSaved: number
  originalPayoff: string
  modifiedPayoff: string
  mode: PrepaymentMode
}

const validRate = (annualRate: number) => Number.isFinite(annualRate)
  && annualRate >= 0
  && annualRate <= 50

const validMonths = (months: number) => Number.isInteger(months) && months >= 1 && months <= 480

const validPrincipal = (principal: number) => Number.isFinite(principal)
  && principal > 0
  && principal <= MAX_MONEY

const invalidSolverInput = () => new Error('Invalid solver input.')

export const solveAffordablePrincipal = ({
  emi,
  annualRate,
  tenureMonths,
}: AffordablePrincipalInput): number => {
  if (!Number.isFinite(emi) || emi <= 0 || !validRate(annualRate) || !validMonths(tenureMonths)) {
    throw invalidSolverInput()
  }
  const monthlyRate = annualRate / 1200
  const principal = roundMoney(monthlyRate === 0
    ? emi * tenureMonths
    : emi * (1 - (1 + monthlyRate) ** -tenureMonths) / monthlyRate)
  if (!Number.isFinite(principal) || principal > MAX_MONEY) throw new Error('Supported principal exceeded.')
  return principal
}

export const solveTenureMonths = ({ principal, annualRate, emi }: TenureSolverInput): number => {
  if (!validPrincipal(principal) || !validRate(annualRate) || !Number.isFinite(emi) || emi <= 0) {
    throw invalidSolverInput()
  }
  const monthlyRate = annualRate / 1200
  if (monthlyRate > 0 && emi <= principal * monthlyRate) {
    throw new Error('EMI must exceed first-month interest.')
  }
  const exactMonths = monthlyRate === 0
    ? principal / emi
    : -Math.log(1 - principal * monthlyRate / emi) / Math.log(1 + monthlyRate)
  const nearestMonth = Math.round(exactMonths)
  const months = Math.abs(exactMonths - nearestMonth) < 0.00005
    ? nearestMonth
    : Math.ceil(exactMonths)
  if (!Number.isFinite(months) || months > 600) throw new Error('Supported tenure exceeded.')
  return months
}

export const solveAnnualRate = ({ principal, emi, tenureMonths }: AnnualRateSolverInput): number => {
  if (!validPrincipal(principal) || !Number.isFinite(emi) || emi <= 0 || !validMonths(tenureMonths)) {
    throw invalidSolverInput()
  }
  const minimumEmi = principal / tenureMonths
  const maximumEmi = calculateEmi(principal, 50, tenureMonths)
  if (emi < minimumEmi - 0.005 || emi > maximumEmi + 0.005) {
    throw new Error('EMI is outside the supported rate range.')
  }
  if (Math.abs(emi - minimumEmi) < 0.005) return 0
  if (Math.abs(emi - maximumEmi) < 0.005) return 50
  let low = 0
  let high = 50
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const rate = (low + high) / 2
    const difference = calculateEmi(principal, rate, tenureMonths) - emi
    if (Math.abs(difference) < 0.005) return rate
    if (difference < 0) low = rate
    else high = rate
  }
  return (low + high) / 2
}

const frequencyInterval = (frequency: Prepayment['frequency']) => frequency === 'once' ? 0
  : frequency === 'monthly' ? 1
    : frequency === 'quarterly' ? 3
      : frequency === 'yearly' ? 12
        : null

const validatePrepayments = (
  scenario: GenericScenario,
  prepayments: Prepayment[],
  payoffCycles: number,
) => {
  if (!Array.isArray(prepayments) || prepayments.length > 100) return false
  const ids = new Set<string>()
  return prepayments.every((item) => {
    if (typeof item !== 'object' || item === null || typeof item.id !== 'string' || !item.id.trim()
      || ids.has(item.id) || !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > MAX_MONEY
      || frequencyInterval(item.frequency) === null) return false
    ids.add(item.id)
    const cycle = cycleIndex(scenario.startDate, item.date)
    return cycle !== null && cycle < payoffCycles
  })
}

const rateAtCycle = (scenario: GenericScenario, cycle: number) => {
  let latestCycle = -1
  let rate = scenario.annualRate
  scenario.rateChanges.forEach((change) => {
    const changeCycle = cycleIndex(scenario.startDate, change.date)
    if (changeCycle !== null && changeCycle <= cycle && changeCycle > latestCycle) {
      latestCycle = changeCycle
      rate = change.annualRate
    }
  })
  return rate
}

const keepTenureChanges = (
  scenario: GenericScenario,
  prepayments: Prepayment[],
  payoffCycles: number,
): RateChange[] => {
  const byDate = new Map(scenario.rateChanges.map((change) => [change.date, change]))
  prepayments.forEach((item) => {
    const start = cycleIndex(scenario.startDate, item.date)!
    const interval = frequencyInterval(item.frequency)!
    for (let cycle = start; cycle < payoffCycles - 1; cycle += interval || payoffCycles) {
      const date = addMonths(scenario.startDate, cycle + 1)
      const existing = byDate.get(date)
      byDate.set(date, {
        id: existing?.id ?? `solver-recast-${cycle}`,
        date,
        annualRate: existing?.annualRate ?? rateAtCycle(scenario, cycle + 1),
        mode: 'keep-tenure',
      })
    }
  })
  return [...byDate.values()]
}

const runModified = (
  scenario: GenericScenario,
  prepayments: Prepayment[],
  rateChanges: RateChange[],
): GenericResult => {
  const engineStartDate = addMonths(scenario.startDate, -1)
  const amortization = buildAmortizationSchedule({
    ...scenario,
    startDate: engineStartDate,
    prepayments: prepayments.map((item) => ({
      ...item,
      date: addMonths(engineStartDate, cycleIndex(scenario.startDate, item.date)! + 1),
    })),
    rateChanges: rateChanges.map((change) => ({
      ...change,
      date: addMonths(engineStartDate, cycleIndex(scenario.startDate, change.date)!),
    })),
    balloonAmount: 0,
  })
  if (amortization.errors.length > 0) {
    throw new Error(`Invalid prepayment comparison. ${amortization.errors[0]}`)
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
  return {
    initialEmi: schedule[0]?.payment ?? amortization.initialEmi,
    totalInterest,
    totalRepayment: roundMoney(scenario.principal + totalInterest + scenario.processingFee),
    payoffDate: schedule.at(-1)?.date ?? scenario.startDate,
    schedule,
  }
}

export const comparePrepayment = ({
  scenario,
  prepayments,
  mode,
}: PrepaymentComparisonInput): PrepaymentComparisonResult => {
  if (mode !== 'keep-emi' && mode !== 'keep-tenure') {
    throw new Error('Invalid prepayment comparison.')
  }
  const baselineResult = calculateGeneric({ ...scenario, prepayments: [] })
  if (baselineResult.view.errors.length > 0
    || !validatePrepayments(scenario, prepayments, baselineResult.native.schedule.length)) {
    throw new Error('Invalid prepayment comparison.')
  }
  const rateChanges = mode === 'keep-tenure'
    ? keepTenureChanges(scenario, prepayments, baselineResult.native.schedule.length)
    : scenario.rateChanges
  const modified = runModified(scenario, prepayments, rateChanges)
  const baseline = baselineResult.native
  return {
    baseline,
    modified,
    interestSaved: roundMoney(baseline.totalInterest - modified.totalInterest),
    monthsSaved: mode === 'keep-tenure' ? 0 : baseline.schedule.length - modified.schedule.length,
    originalPayoff: baseline.payoffDate,
    modifiedPayoff: modified.payoffDate,
    mode,
  }
}
