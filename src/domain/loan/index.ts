export type MoneyMode = 'amount' | 'percent'
export type RateResetMode = 'keep-emi' | 'keep-tenure'
export type PrepaymentFrequency = 'monthly' | 'quarterly' | 'yearly' | 'once'
export type OdTransactionType = 'deposit' | 'withdrawal'

export interface RateChange {
  id: string
  date: string
  annualRate: number
  mode: RateResetMode
}

export interface Prepayment {
  id: string
  date: string
  amount: number
  frequency: PrepaymentFrequency
}

export interface OdTransaction {
  id: string
  date: string
  type: OdTransactionType
  amount: number
}

export interface LoanScenario {
  homeValue: number
  downPayment: number
  downPaymentMode: MoneyMode
  loanInsurance: number
  annualRate: number
  tenureMonths: number
  startDate: string
  processingFee: number
  processingFeeMode: MoneyMode
  oneTimeExpenses: number
  oneTimeExpensesMode: MoneyMode
  propertyTaxAnnual: number
  propertyTaxMode: MoneyMode
  homeInsuranceAnnual: number
  homeInsuranceMode: MoneyMode
  maintenanceMonthly: number
  rateChanges: RateChange[]
  prepayments: Prepayment[]
  od: {
    enabled: boolean
    premiumRate: number
    setupFee: number
    annualFee: number
    openingSurplus: number
    openingSurplusMode: MoneyMode
    monthlyContribution: number
    transactionsEnabled: boolean
    transactions: OdTransaction[]
  }
}

export interface ScheduleRow {
  month: number
  date: string
  annualRate: number
  emi: number
  principal: number
  interest: number
  prepayment: number
  balance: number
  ownershipCost: number
}

export interface OdScheduleRow {
  month: number
  date: string
  annualRate: number
  payment: number
  principalReduction: number
  interest: number
  prepayment: number
  deposit: number
  withdrawal: number
  fee: number
  drawingPower: number
  parkedSurplus: number
  availableWithdrawal: number
  netUtilized: number
}

export interface CalculationResult {
  scenario: LoanScenario
  loanAmount: number
  downPaymentAmount: number
  processingFeeAmount: number
  oneTimeExpensesAmount: number
  monthlyOwnershipCost: number
  ownershipCostOverOriginalTenure: number
  upfrontCash: number
  standard: {
    initialEmi: number
    totalInterest: number
    totalPrepayments: number
    payoffDate: string
    schedule: ScheduleRow[]
    totalModelledOutflow: number
  }
  od: {
    enabled: boolean
    effectiveInitialRate: number
    totalInterest: number
    totalFees: number
    feeAdjustedSavings: number
    contractualPayoffDate: string
    netDebtFreeDate: string | null
    endingParkedSurplus: number
    schedule: OdScheduleRow[]
    totalModelledOutflow: number
  }
  warnings: string[]
  errors: string[]
}

const DAY_MS = 86_400_000
const MAX_MONEY = 1_000_000_000
const MAX_MONTHS = 600

export const roundMoney = (value: number) => {
  const scaled = value * 100
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled))
  return (scaled >= 0
    ? Math.floor(scaled + 0.5 + tolerance)
    : Math.ceil(scaled - 0.5 - tolerance)) / 100
}

export const amountFromMode = (value: number, mode: MoneyMode, base: number) =>
  roundMoney(mode === 'percent' ? (base * value) / 100 : value)

export const toEpochDay = (date: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return Number.NaN
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return Number.NaN
  }
  return Math.floor(timestamp / DAY_MS)
}

export const fromEpochDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10)

export const addMonths = (date: string, months: number) => {
  const epoch = toEpochDay(date)
  if (!Number.isFinite(epoch)) return ''
  const source = new Date(epoch * DAY_MS)
  const targetMonth = source.getUTCMonth() + months
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(source.getUTCDate(), lastDay)))
    .toISOString()
    .slice(0, 10)
}

export const cycleIndex = (startDate: string, candidate: string): number | null => {
  const startDay = toEpochDay(startDate)
  const candidateDay = toEpochDay(candidate)
  if (!Number.isFinite(startDay) || !Number.isFinite(candidateDay) || candidateDay < startDay) return null
  const start = new Date(startDay * DAY_MS)
  const target = new Date(candidateDay * DAY_MS)
  const index = (target.getUTCFullYear() - start.getUTCFullYear()) * 12
    + target.getUTCMonth() - start.getUTCMonth()
  return index <= MAX_MONTHS && addMonths(startDate, index) === candidate ? index : null
}

export const calculateEmi = (principal: number, annualRate: number, months: number) => {
  if (principal <= 0 || months <= 0) return 0
  const monthlyRate = annualRate / 1200
  if (monthlyRate === 0) return roundMoney(principal / months)
  const factor = (1 + monthlyRate) ** months
  return roundMoney((principal * monthlyRate * factor) / (factor - 1))
}

const nextMonthStart = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
}

export const defaultScenario = (): LoanScenario => ({
  homeValue: 5_000_000,
  downPayment: 20,
  downPaymentMode: 'percent',
  loanInsurance: 0,
  annualRate: 9,
  tenureMonths: 240,
  startDate: nextMonthStart(),
  processingFee: 0.25,
  processingFeeMode: 'percent',
  oneTimeExpenses: 10,
  oneTimeExpensesMode: 'percent',
  propertyTaxAnnual: 0.25,
  propertyTaxMode: 'percent',
  homeInsuranceAnnual: 0.05,
  homeInsuranceMode: 'percent',
  maintenanceMonthly: 2_500,
  rateChanges: [],
  prepayments: [],
  od: {
    enabled: false,
    premiumRate: 0,
    setupFee: 0,
    annualFee: 0,
    openingSurplus: 0,
    openingSurplusMode: 'amount',
    monthlyContribution: 0,
    transactionsEnabled: false,
    transactions: [],
  },
})

const isCycleDate = (startDate: string, candidate: string) => cycleIndex(startDate, candidate) !== null

const prepaymentDue = (item: Prepayment, paymentCycle: number, startCycle: number) => {
  const delta = paymentCycle - startCycle
  if (delta < 0) return false
  const interval = item.frequency === 'once' ? 0
    : item.frequency === 'monthly' ? 1
      : item.frequency === 'quarterly' ? 3
        : 12
  return interval === 0 ? delta === 0 : delta % interval === 0
}

export const validateScenario = (scenario: LoanScenario) => {
  const errors: string[] = []
  const checkMoney = (label: string, value: number, allowZero = true) => {
    if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY || (!allowZero && value === 0)) {
      errors.push(`${label} must be ${allowZero ? 'between ₹0' : 'above ₹0'} and ₹100 crore.`)
    }
  }

  checkMoney('Home value', scenario.homeValue, false)
  checkMoney('Down payment', scenario.downPayment)
  checkMoney('Loan insurance', scenario.loanInsurance)
  checkMoney('Processing fee', scenario.processingFee)
  checkMoney('One-time expenses', scenario.oneTimeExpenses)
  checkMoney('Property tax', scenario.propertyTaxAnnual)
  checkMoney('Home insurance', scenario.homeInsuranceAnnual)
  checkMoney('Maintenance', scenario.maintenanceMonthly)
  if (!Number.isInteger(scenario.tenureMonths) || scenario.tenureMonths < 1 || scenario.tenureMonths > 480) {
    errors.push('Tenure must be between 1 and 480 months.')
  }
  if (scenario.annualRate < 0 || scenario.annualRate > 50) errors.push('Interest rate must be between 0% and 50%.')
  if (!Number.isFinite(toEpochDay(scenario.startDate))) errors.push('Start date must be a valid calendar date.')

  for (const [label, value, mode] of [
    ['Down payment', scenario.downPayment, scenario.downPaymentMode],
    ['Processing fee', scenario.processingFee, scenario.processingFeeMode],
    ['One-time expenses', scenario.oneTimeExpenses, scenario.oneTimeExpensesMode],
    ['Property tax', scenario.propertyTaxAnnual, scenario.propertyTaxMode],
    ['Home insurance', scenario.homeInsuranceAnnual, scenario.homeInsuranceMode],
  ] as const) {
    if (mode === 'percent' && value > 100) errors.push(`${label} percentage must be between 0% and 100%.`)
  }

  scenario.rateChanges.forEach((change) => {
    if (!isCycleDate(scenario.startDate, change.date) || change.date === scenario.startDate) {
      errors.push(`Rate change ${change.date || '(missing date)'} must fall on a future EMI cycle date.`)
    }
    if (change.annualRate < 0 || change.annualRate > 50) errors.push('Changed rate must be between 0% and 50%.')
  })
  scenario.prepayments.forEach((item) => {
    if (!isCycleDate(scenario.startDate, item.date) || item.date === scenario.startDate) {
      errors.push(`Prepayment ${item.date || '(missing date)'} must fall on a future EMI date.`)
    }
    checkMoney('Prepayment', item.amount)
  })

  if (scenario.od.enabled) {
    if (scenario.od.premiumRate < 0 || scenario.od.premiumRate > 20) errors.push('OD premium must be between 0% and 20%.')
    checkMoney('OD setup fee', scenario.od.setupFee)
    checkMoney('OD annual fee', scenario.od.annualFee)
    checkMoney('Opening parked surplus', scenario.od.openingSurplus)
    checkMoney('Monthly parked surplus', scenario.od.monthlyContribution)
    if (scenario.od.openingSurplusMode === 'percent' && scenario.od.openingSurplus > 100) {
      errors.push('Opening parked surplus percentage must be between 0% and 100%.')
    }
    const transactions = scenario.od.transactionsEnabled ? scenario.od.transactions : []
    if (transactions.length > 100) errors.push('OD transactions are limited to 100 entries.')
    transactions.forEach((transaction) => {
      checkMoney('OD transaction', transaction.amount)
      const day = toEpochDay(transaction.date)
      if (!Number.isFinite(day) || day < toEpochDay(scenario.startDate)) {
        errors.push(`OD transaction ${transaction.date || '(missing date)'} cannot precede the loan start date.`)
      }
    })
  }

  const downPayment = amountFromMode(scenario.downPayment, scenario.downPaymentMode, scenario.homeValue)
  const loanAmount = roundMoney(scenario.homeValue + scenario.loanInsurance - downPayment)
  if (loanAmount <= 0) errors.push('Loan amount must remain above ₹0 after down payment.')
  return errors
}

const buildStandardSchedule = (scenario: LoanScenario, loanAmount: number, monthlyOwnershipCost: number) => {
  const errors: string[] = []
  const schedule: ScheduleRow[] = []
  const changes = new Map(scenario.rateChanges.map((change) => [change.date, change]))
  const prepayments = scenario.prepayments
    .map((item) => ({ item, startCycle: cycleIndex(scenario.startDate, item.date) }))
    .filter((entry): entry is { item: Prepayment, startCycle: number } => entry.startCycle !== null)
  let annualRate = scenario.annualRate
  let balance = loanAmount
  let emi = calculateEmi(balance, annualRate, scenario.tenureMonths)
  const initialEmi = emi
  let extensionAllowed = false

  for (let month = 0; month < MAX_MONTHS && balance > 0.005; month += 1) {
    const periodStart = addMonths(scenario.startDate, month)
    const paymentDate = addMonths(scenario.startDate, month + 1)
    const change = changes.get(periodStart)
    if (change) {
      annualRate = change.annualRate
      extensionAllowed = change.mode === 'keep-emi'
      if (change.mode === 'keep-tenure') {
        const remaining = Math.max(1, scenario.tenureMonths - month)
        emi = calculateEmi(balance, annualRate, remaining)
      }
    }

    const interest = roundMoney(balance * (annualRate / 1200))
    if (emi <= interest && balance > emi) {
      errors.push(`EMI is insufficient after the rate change effective ${periodStart}. Minimum EMI is ${roundMoney(interest + 0.01)}.`)
      break
    }
    const isFinalFixedTenurePayment = !extensionAllowed && month === scenario.tenureMonths - 1
    const principal = roundMoney(
      isFinalFixedTenurePayment ? balance : Math.min(balance, Math.max(0, emi - interest)),
    )
    const duePrepayment = roundMoney(
      prepayments
        .filter(({ item, startCycle }) => prepaymentDue(item, month + 1, startCycle))
        .reduce((sum, { item }) => sum + item.amount, 0),
    )
    const prepayment = roundMoney(Math.min(Math.max(0, balance - principal), duePrepayment))
    balance = roundMoney(Math.max(0, balance - principal - prepayment))
    schedule.push({
      month: month + 1,
      date: paymentDate,
      annualRate,
      emi: roundMoney(interest + principal),
      principal,
      interest,
      prepayment,
      balance,
      ownershipCost: monthlyOwnershipCost,
    })
  }

  if (balance > 0.005 && errors.length === 0) errors.push('The loan did not amortize within the 600-month calculation limit.')
  return { schedule, errors, initialEmi }
}

const buildOdSchedule = (
  scenario: LoanScenario,
  loanAmount: number,
  standardSchedule: ScheduleRow[],
  openingSurplusAmount: number,
) => {
  if (!scenario.od.enabled) {
    return {
      schedule: standardSchedule.map<OdScheduleRow>((row) => ({
        month: row.month,
        date: row.date,
        annualRate: row.annualRate,
        payment: row.emi,
        principalReduction: row.principal,
        interest: row.interest,
        prepayment: row.prepayment,
        deposit: 0,
        withdrawal: 0,
        fee: 0,
        drawingPower: row.balance,
        parkedSurplus: 0,
        availableWithdrawal: 0,
        netUtilized: row.balance,
      })),
      errors: [] as string[],
      warnings: [] as string[],
      totalFees: 0,
      netDebtFreeDate: null as string | null,
    }
  }

  const errors: string[] = []
  const warnings: string[] = []
  const schedule: OdScheduleRow[] = []
  const transactions = scenario.od.transactionsEnabled ? scenario.od.transactions : []
  const transactionMap = new Map<number, OdTransaction[]>()
  transactions.forEach((transaction) => {
    const day = toEpochDay(transaction.date)
    const list = transactionMap.get(day) ?? []
    list.push(transaction)
    transactionMap.set(day, list)
  })

  let drawingPower = loanAmount
  let parkedSurplus = openingSurplusAmount
  let totalFees = scenario.od.setupFee
  let netDebtFreeDate: string | null = parkedSurplus >= drawingPower ? scenario.startDate : null
  let excessWarned = parkedSurplus > drawingPower
  if (excessWarned) {
    warnings.push('Parked surplus exceeds drawing power; the excess remains withdrawable but earns no additional interest benefit.')
  }

  for (let index = 0; index < standardSchedule.length; index += 1) {
    const standardRow = standardSchedule[index]!
    const periodStart = addMonths(scenario.startDate, index)
    const periodEnd = standardRow.date
    const startDay = toEpochDay(periodStart)
    const endDay = toEpochDay(periodEnd)
    let deposits = 0
    let withdrawals = 0
    let accruedInterest = 0

    for (let day = startDay; day < endDay; day += 1) {
      const dayTransactions = transactionMap.get(day) ?? []
      const dayDeposits = dayTransactions
        .filter((transaction) => transaction.type === 'deposit')
        .reduce((sum, transaction) => sum + transaction.amount, 0)
      const dayWithdrawals = dayTransactions
        .filter((transaction) => transaction.type === 'withdrawal')
        .reduce((sum, transaction) => sum + transaction.amount, 0)
      if (dayDeposits > 0) {
        parkedSurplus = roundMoney(parkedSurplus + dayDeposits)
        deposits = roundMoney(deposits + dayDeposits)
      }
      if (dayWithdrawals > parkedSurplus + 0.005) {
        errors.push(`Withdrawal on ${fromEpochDay(day)} exceeds the available parked surplus.`)
        break
      }
      if (dayWithdrawals > 0) {
        parkedSurplus = roundMoney(parkedSurplus - dayWithdrawals)
        withdrawals = roundMoney(withdrawals + dayWithdrawals)
      }
      const netUtilized = Math.max(0, drawingPower - parkedSurplus)
      accruedInterest += netUtilized * ((standardRow.annualRate + scenario.od.premiumRate) / 100 / 365)
      if (!netDebtFreeDate && parkedSurplus >= drawingPower) netDebtFreeDate = fromEpochDay(day)
    }
    if (errors.length > 0) break

    const postedInterest = roundMoney(accruedInterest)
    const wasOpenAtPayment = drawingPower > 0.005
    const contractualPrincipal = Math.min(drawingPower, standardRow.principal)
    const prepayment = Math.min(Math.max(0, drawingPower - contractualPrincipal), standardRow.prepayment)
    const requiredPayment = roundMoney(postedInterest + contractualPrincipal)
    const payment = Math.max(standardRow.emi, requiredPayment)
    const paymentExcess = roundMoney(Math.max(0, payment - requiredPayment))
    parkedSurplus = roundMoney(parkedSurplus + paymentExcess)
    drawingPower = roundMoney(Math.max(0, drawingPower - contractualPrincipal - prepayment))

    const monthlyDeposit = drawingPower > 0.005 ? scenario.od.monthlyContribution : 0
    parkedSurplus = roundMoney(parkedSurplus + monthlyDeposit)
    deposits = roundMoney(deposits + monthlyDeposit)

    const annualFee = (index + 1) % 12 === 0 && wasOpenAtPayment ? scenario.od.annualFee : 0
    totalFees = roundMoney(totalFees + annualFee)
    if (parkedSurplus > drawingPower && !excessWarned) {
      warnings.push('Parked surplus exceeds drawing power; the excess remains withdrawable but earns no additional interest benefit.')
      excessWarned = true
    }
    if (!netDebtFreeDate && parkedSurplus >= drawingPower) netDebtFreeDate = periodEnd

    schedule.push({
      month: index + 1,
      date: periodEnd,
      annualRate: standardRow.annualRate + scenario.od.premiumRate,
      payment,
      principalReduction: contractualPrincipal,
      interest: postedInterest,
      prepayment,
      deposit: deposits,
      withdrawal: withdrawals,
      fee: annualFee + (index === 0 ? scenario.od.setupFee : 0),
      drawingPower,
      parkedSurplus,
      availableWithdrawal: parkedSurplus,
      netUtilized: roundMoney(Math.max(0, drawingPower - parkedSurplus)),
    })
  }

  return { schedule, errors, warnings, totalFees, netDebtFreeDate }
}

export const calculateLoan = (scenario: LoanScenario): CalculationResult => {
  const validationErrors = validateScenario(scenario)
  const downPaymentAmount = amountFromMode(scenario.downPayment, scenario.downPaymentMode, scenario.homeValue)
  const loanAmount = roundMoney(scenario.homeValue + scenario.loanInsurance - downPaymentAmount)
  const processingFeeAmount = amountFromMode(scenario.processingFee, scenario.processingFeeMode, loanAmount)
  const oneTimeExpensesAmount = amountFromMode(scenario.oneTimeExpenses, scenario.oneTimeExpensesMode, scenario.homeValue)
  const propertyTax = amountFromMode(scenario.propertyTaxAnnual, scenario.propertyTaxMode, scenario.homeValue)
  const homeInsurance = amountFromMode(scenario.homeInsuranceAnnual, scenario.homeInsuranceMode, scenario.homeValue)
  const monthlyOwnershipCost = roundMoney(propertyTax / 12 + homeInsurance / 12 + scenario.maintenanceMonthly)
  const ownershipCostOverOriginalTenure = roundMoney(monthlyOwnershipCost * scenario.tenureMonths)
  const upfrontCash = roundMoney(downPaymentAmount + processingFeeAmount + oneTimeExpensesAmount)
  const standard = buildStandardSchedule(scenario, Math.max(0, loanAmount), monthlyOwnershipCost)
  const calculatedPayoffDay = toEpochDay(standard.schedule.at(-1)?.date ?? scenario.startDate)
  const postPayoffErrors = scenario.od.enabled && scenario.od.transactionsEnabled
    ? scenario.od.transactions
        .filter((transaction) => toEpochDay(transaction.date) >= calculatedPayoffDay)
        .map((transaction) => `OD transaction ${transaction.date} must occur before the calculated payoff date.`)
    : []
  const openingSurplusAmount = amountFromMode(scenario.od.openingSurplus, scenario.od.openingSurplusMode, loanAmount)
  const od = buildOdSchedule(scenario, Math.max(0, loanAmount), standard.schedule, openingSurplusAmount)
  const errors = [...validationErrors, ...standard.errors, ...postPayoffErrors, ...od.errors]
  const totalInterest = roundMoney(standard.schedule.reduce((sum, row) => sum + row.interest, 0))
  const totalPrepayments = roundMoney(standard.schedule.reduce((sum, row) => sum + row.prepayment, 0))
  const odInterest = roundMoney(od.schedule.reduce((sum, row) => sum + row.interest, 0))
  const feeAdjustedSavings = scenario.od.enabled ? roundMoney(totalInterest - odInterest - od.totalFees) : 0
  const payoffDate = standard.schedule.at(-1)?.date ?? scenario.startDate
  const odPayoffDate = od.schedule.at(-1)?.date ?? payoffDate

  return {
    scenario,
    loanAmount,
    downPaymentAmount,
    processingFeeAmount,
    oneTimeExpensesAmount,
    monthlyOwnershipCost,
    ownershipCostOverOriginalTenure,
    upfrontCash,
    standard: {
      initialEmi: standard.initialEmi,
      totalInterest,
      totalPrepayments,
      payoffDate,
      schedule: standard.schedule,
      totalModelledOutflow: roundMoney(upfrontCash + loanAmount + totalInterest + ownershipCostOverOriginalTenure),
    },
    od: {
      enabled: scenario.od.enabled,
      effectiveInitialRate: scenario.annualRate + (scenario.od.enabled ? scenario.od.premiumRate : 0),
      totalInterest: odInterest,
      totalFees: od.totalFees,
      feeAdjustedSavings,
      contractualPayoffDate: odPayoffDate,
      netDebtFreeDate: od.netDebtFreeDate,
      endingParkedSurplus: od.schedule.at(-1)?.parkedSurplus ?? openingSurplusAmount,
      schedule: od.schedule,
      totalModelledOutflow: roundMoney(upfrontCash + loanAmount + odInterest + od.totalFees + ownershipCostOverOriginalTenure),
    },
    warnings: od.warnings,
    errors,
  }
}

export const formatCurrency = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0)
