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

const validEmi = (emi: number) => Number.isFinite(emi) && emi > 0 && emi <= MAX_MONEY

const invalidSolverInput = () => new Error('Invalid solver input.')

export const solveAffordablePrincipal = ({
  emi,
  annualRate,
  tenureMonths,
}: AffordablePrincipalInput): number => {
  if (!validEmi(emi) || !validRate(annualRate) || !validMonths(tenureMonths)) {
    throw invalidSolverInput()
  }
  const monthlyRate = annualRate / 1200
  const principal = roundMoney(monthlyRate === 0
    ? emi * tenureMonths
    : emi * (-Math.expm1(-tenureMonths * Math.log1p(monthlyRate))) / monthlyRate)
  if (!Number.isFinite(principal) || principal > MAX_MONEY) throw new Error('Supported principal exceeded.')
  return principal
}

export const solveTenureMonths = ({ principal, annualRate, emi }: TenureSolverInput): number => {
  if (!validPrincipal(principal) || !validRate(annualRate) || !validEmi(emi)) {
    throw invalidSolverInput()
  }
  const monthlyRate = annualRate / 1200
  if (monthlyRate > 0 && emi <= principal * monthlyRate) {
    throw new Error('EMI must exceed first-month interest.')
  }
  const exactMonths = monthlyRate === 0
    ? principal / emi
    : -Math.log1p(-principal * monthlyRate / emi) / Math.log1p(monthlyRate)
  const months = Math.ceil(exactMonths)
  if (!Number.isFinite(months) || months > 600) throw new Error('Supported tenure exceeded.')
  return months
}

export const solveAnnualRate = ({ principal, emi, tenureMonths }: AnnualRateSolverInput): number => {
  if (!validPrincipal(principal) || !validEmi(emi) || !validMonths(tenureMonths)) {
    throw invalidSolverInput()
  }
  const minimumEmi = calculateEmi(principal, 0, tenureMonths)
  const maximumEmi = calculateEmi(principal, 50, tenureMonths)
  if (emi < minimumEmi || emi > maximumEmi) {
    throw new Error('EMI is outside the supported rate range.')
  }
  if (emi === minimumEmi) return 0
  if (emi === maximumEmi) return 50
  let low = 0
  let high = 50
  for (let iteration = 0; iteration < 100 && high - low > 1e-10; iteration += 1) {
    const rate = (low + high) / 2
    const monthlyRate = rate / 1200
    const rawEmi = principal * monthlyRate
      / (-Math.expm1(-tenureMonths * Math.log1p(monthlyRate)))
    if (rawEmi < emi) low = rate
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
  const firstPrepaymentCycle = Math.min(
    ...prepayments.map((item) => cycleIndex(scenario.startDate, item.date)!),
  )
  const byDate = new Map(scenario.rateChanges.map((change) => {
    const changeCycle = cycleIndex(scenario.startDate, change.date)!
    return [change.date, {
      ...change,
      mode: changeCycle <= firstPrepaymentCycle ? change.mode : 'keep-tenure' as const,
    }]
  }))
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
  comparisonControls: Pick<
    Parameters<typeof buildAmortizationSchedule>[0],
    'initialEmiOverride' | 'keepTenureTargetMonths'
  > = {},
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
    ...comparisonControls,
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
  const baseline = baselineResult.native
  const modified = runModified(
    scenario,
    prepayments,
    rateChanges,
    mode === 'keep-tenure' ? {
      initialEmiOverride: baseline.initialEmi,
      keepTenureTargetMonths: baseline.schedule.length,
    } : {},
  )
  if (mode === 'keep-tenure'
    && (modified.schedule.length !== baseline.schedule.length
      || modified.payoffDate !== baseline.payoffDate
      || modified.schedule.some(({ payment }) => payment <= 0))) {
    throw new Error('Cannot preserve baseline payoff.')
  }
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
