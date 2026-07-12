import {
  buildAmortizationSchedule,
  cycleIndex,
  fromEpochDay,
  roundMoney,
  toEpochDay,
} from '../amortization'

export { addMonths, calculateEmi, cycleIndex, fromEpochDay, roundMoney, toEpochDay } from '../amortization'

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

export interface ValidationIssue {
  field: string
  message: string
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
  issues: ValidationIssue[]
  errors: string[]
}

const MAX_MONEY = 1_000_000_000

export const amountFromMode = (value: number, mode: MoneyMode, base: number) =>
  roundMoney(mode === 'percent' ? (base * value) / 100 : value)

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

const duplicates = <T>(items: T[], key: (item: T) => string) => {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  items.forEach((item) => {
    const value = key(item)
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  })
  return repeated
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const validateScenario = (scenario: LoanScenario): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  const addIssue = (field: string, message: string) => issues.push({ field, message })
  const checkMoney = (field: string, label: string, value: unknown, allowZero = true) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_MONEY || (!allowZero && value === 0)) {
      addIssue(field, `${label} must be ${allowZero ? 'between ₹0' : 'above ₹0'} and ₹100 crore.`)
    }
  }
  const checkMode = (field: string, value: unknown) => {
    if (value !== 'amount' && value !== 'percent') addIssue(field, 'Mode must be amount or percent.')
  }
  const itemField = (list: string, id: unknown, index: number, field: string) =>
    `${list}.${typeof id === 'string' && id.trim() ? id : index}.${field}`

  checkMoney('homeValue', 'Home value', scenario.homeValue, false)
  checkMoney('downPayment', 'Down payment', scenario.downPayment)
  checkMoney('loanInsurance', 'Loan insurance', scenario.loanInsurance)
  checkMoney('processingFee', 'Processing fee', scenario.processingFee)
  checkMoney('oneTimeExpenses', 'One-time expenses', scenario.oneTimeExpenses)
  checkMoney('propertyTaxAnnual', 'Property tax', scenario.propertyTaxAnnual)
  checkMoney('homeInsuranceAnnual', 'Home insurance', scenario.homeInsuranceAnnual)
  checkMoney('maintenanceMonthly', 'Maintenance', scenario.maintenanceMonthly)
  if (!Number.isInteger(scenario.tenureMonths) || scenario.tenureMonths < 1 || scenario.tenureMonths > 480) {
    addIssue('tenureMonths', 'Tenure must be between 1 and 480 months.')
  }
  if (!Number.isFinite(scenario.annualRate) || scenario.annualRate < 0 || scenario.annualRate > 50) {
    addIssue('annualRate', 'Interest rate must be between 0% and 50%.')
  }
  if (!Number.isFinite(toEpochDay(scenario.startDate))) addIssue('startDate', 'Start date must be a valid calendar date.')

  for (const [field, label, value, mode] of [
    ['downPayment', 'Down payment', scenario.downPayment, scenario.downPaymentMode],
    ['processingFee', 'Processing fee', scenario.processingFee, scenario.processingFeeMode],
    ['oneTimeExpenses', 'One-time expenses', scenario.oneTimeExpenses, scenario.oneTimeExpensesMode],
    ['propertyTaxAnnual', 'Property tax', scenario.propertyTaxAnnual, scenario.propertyTaxMode],
    ['homeInsuranceAnnual', 'Home insurance', scenario.homeInsuranceAnnual, scenario.homeInsuranceMode],
  ] as const) {
    checkMode(`${field}Mode`, mode)
    if (mode === 'percent' && (!Number.isFinite(value) || value > 100)) {
      addIssue(field, `${label} percentage must be between 0% and 100%.`)
    }
  }

  const rateChanges: unknown[] = scenario.rateChanges
  const validRateChanges = rateChanges.filter(isRecord)
  const identifiedRateChanges = validRateChanges.filter(({ id }) => typeof id === 'string' && id.trim())
  if (rateChanges.length > 100) addIssue('rateChanges', 'Rate changes are limited to 100 entries.')
  if (duplicates(identifiedRateChanges, ({ id }) => id as string).size > 0) {
    addIssue('rateChanges', 'Rate-change IDs must be unique.')
  }
  rateChanges.forEach((change, index) => {
    if (!isRecord(change)) {
      addIssue(`rateChanges.${index}`, 'Rate change entry must be an object.')
      return
    }
    if (typeof change.id !== 'string' || !change.id.trim()) {
      addIssue(itemField('rateChanges', change.id, index, 'id'), 'Rate-change IDs must not be blank.')
    }
    const validDate = typeof change.date === 'string'
      && isCycleDate(scenario.startDate, change.date)
      && change.date !== scenario.startDate
    if (!validDate) {
      const date = typeof change.date === 'string' && change.date ? change.date : '(missing date)'
      addIssue(itemField('rateChanges', change.id, index, 'date'), `Rate change ${date} must fall on a future EMI cycle date.`)
    }
    if (typeof change.annualRate !== 'number' || !Number.isFinite(change.annualRate) || change.annualRate < 0 || change.annualRate > 50) {
      addIssue(itemField('rateChanges', change.id, index, 'annualRate'), 'Changed rate must be between 0% and 50%.')
    }
    if (change.mode !== 'keep-emi' && change.mode !== 'keep-tenure') {
      addIssue(itemField('rateChanges', change.id, index, 'mode'), 'Rate-change mode must be keep-emi or keep-tenure.')
    }
  })
  const candidateRateDates = validRateChanges
    .map(({ date }) => date)
    .filter((date): date is string => typeof date === 'string'
      && isCycleDate(scenario.startDate, date)
      && date !== scenario.startDate)
  duplicates(candidateRateDates, (date) => date).forEach((date) => {
    addIssue('rateChanges', `Only one rate change may apply on ${date}.`)
  })

  const prepayments: unknown[] = scenario.prepayments
  const validPrepayments = prepayments.filter(isRecord)
  const identifiedPrepayments = validPrepayments.filter(({ id }) => typeof id === 'string' && id.trim())
  if (prepayments.length > 100) addIssue('prepayments', 'Prepayments are limited to 100 entries.')
  if (duplicates(identifiedPrepayments, ({ id }) => id as string).size > 0) {
    addIssue('prepayments', 'Prepayment IDs must be unique.')
  }
  prepayments.forEach((item, index) => {
    if (!isRecord(item)) {
      addIssue(`prepayments.${index}`, 'Prepayment entry must be an object.')
      return
    }
    if (typeof item.id !== 'string' || !item.id.trim()) {
      addIssue(itemField('prepayments', item.id, index, 'id'), 'Prepayment IDs must not be blank.')
    }
    const validDate = typeof item.date === 'string'
      && isCycleDate(scenario.startDate, item.date)
      && item.date !== scenario.startDate
    if (!validDate) {
      const date = typeof item.date === 'string' && item.date ? item.date : '(missing date)'
      addIssue(itemField('prepayments', item.id, index, 'date'), `Prepayment ${date} must fall on a future EMI date.`)
    }
    checkMoney(itemField('prepayments', item.id, index, 'amount'), 'Prepayment', item.amount)
    if (item.frequency !== 'monthly' && item.frequency !== 'quarterly'
      && item.frequency !== 'yearly' && item.frequency !== 'once') {
      addIssue(itemField('prepayments', item.id, index, 'frequency'), 'Prepayment frequency is invalid.')
    }
  })

  if (scenario.od.enabled) {
    if (!Number.isFinite(scenario.od.premiumRate) || scenario.od.premiumRate < 0 || scenario.od.premiumRate > 20) {
      addIssue('od.premiumRate', 'OD premium must be between 0% and 20%.')
    }
    checkMoney('od.setupFee', 'OD setup fee', scenario.od.setupFee)
    checkMoney('od.annualFee', 'OD annual fee', scenario.od.annualFee)
    checkMoney('od.openingSurplus', 'Opening parked surplus', scenario.od.openingSurplus)
    checkMoney('od.monthlyContribution', 'Monthly parked surplus', scenario.od.monthlyContribution)
    checkMode('od.openingSurplusMode', scenario.od.openingSurplusMode)
    if (scenario.od.openingSurplusMode === 'percent' && (!Number.isFinite(scenario.od.openingSurplus) || scenario.od.openingSurplus > 100)) {
      addIssue('od.openingSurplus', 'Opening parked surplus percentage must be between 0% and 100%.')
    }
    const transactions: unknown[] = scenario.od.transactionsEnabled ? scenario.od.transactions : []
    const validTransactions = transactions.filter(isRecord)
    const identifiedTransactions = validTransactions.filter(({ id }) => typeof id === 'string' && id.trim())
    if (transactions.length > 100) addIssue('od.transactions', 'OD transactions are limited to 100 entries.')
    if (duplicates(identifiedTransactions, ({ id }) => id as string).size > 0) {
      addIssue('od.transactions', 'OD transaction IDs must be unique.')
    }
    transactions.forEach((transaction, index) => {
      if (!isRecord(transaction)) {
        addIssue(`od.transactions.${index}`, 'OD transaction entry must be an object.')
        return
      }
      if (typeof transaction.id !== 'string' || !transaction.id.trim()) {
        addIssue(itemField('od.transactions', transaction.id, index, 'id'), 'OD transaction IDs must not be blank.')
      }
      checkMoney(itemField('od.transactions', transaction.id, index, 'amount'), 'OD transaction', transaction.amount)
      if (transaction.type !== 'deposit' && transaction.type !== 'withdrawal') {
        addIssue(itemField('od.transactions', transaction.id, index, 'type'), 'OD transaction type must be deposit or withdrawal.')
      }
      const day = typeof transaction.date === 'string' ? toEpochDay(transaction.date) : Number.NaN
      if (!Number.isFinite(day) || day < toEpochDay(scenario.startDate)) {
        const date = typeof transaction.date === 'string' && transaction.date ? transaction.date : '(missing date)'
        addIssue(itemField('od.transactions', transaction.id, index, 'date'), `OD transaction ${date} cannot precede the loan start date.`)
      }
    })
  }

  const downPayment = amountFromMode(scenario.downPayment, scenario.downPaymentMode, scenario.homeValue)
  const loanAmount = roundMoney(scenario.homeValue + scenario.loanInsurance - downPayment)
  if (Number.isFinite(loanAmount) && loanAmount <= 0) addIssue('loanAmount', 'Loan amount must remain above ₹0 after down payment.')
  return issues
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
  const payments = new Map(standardSchedule.map((row, index) => [toEpochDay(row.date), { row, index }]))
  const transactionsByDay = new Map<number, OdTransaction[]>()
  transactions.forEach((transaction) => {
    const day = toEpochDay(transaction.date)
    transactionsByDay.set(day, [...(transactionsByDay.get(day) ?? []), transaction])
  })

  let drawingPower = loanAmount
  let parkedSurplus = openingSurplusAmount
  let totalFees = 0
  let accruedInterest = 0
  let activeRate = (standardSchedule[0]?.annualRate ?? scenario.annualRate) + scenario.od.premiumRate
  let periodDeposits = 0
  let periodWithdrawals = 0
  let lastPositiveDay: number | null = null
  let excessWarned = parkedSurplus > drawingPower
  if (excessWarned) {
    warnings.push('Parked surplus exceeds drawing power; the excess remains withdrawable but earns no additional interest benefit.')
  }

  const finalPaymentDay = toEpochDay(standardSchedule.at(-1)?.date ?? scenario.startDate)
  for (let day = toEpochDay(scenario.startDate); day <= finalPaymentDay; day += 1) {
    const paymentEvent = payments.get(day)
    let postedInterest = 0
    let annualFee = 0
    let prepayment = 0
    let payment = 0
    let principalReduction = 0

    if (paymentEvent) {
      postedInterest = roundMoney(accruedInterest)
      accruedInterest = 0
      const { row, index } = paymentEvent
      const wasOpen = drawingPower > 0.005
      principalReduction = roundMoney(Math.min(drawingPower, row.principal))
      prepayment = roundMoney(Math.min(Math.max(0, drawingPower - principalReduction), row.prepayment))
      const requiredPayment = roundMoney(postedInterest + principalReduction)
      payment = Math.max(row.emi, requiredPayment)
      parkedSurplus = roundMoney(parkedSurplus + Math.max(0, payment - requiredPayment))
      drawingPower = roundMoney(Math.max(0, drawingPower - principalReduction - prepayment))
      if (drawingPower > 0.005) {
        parkedSurplus = roundMoney(parkedSurplus + scenario.od.monthlyContribution)
        periodDeposits = roundMoney(periodDeposits + scenario.od.monthlyContribution)
      }
      annualFee = (index + 1) % 12 === 0 && wasOpen ? scenario.od.annualFee : 0
    }

    const dayTransactions = transactionsByDay.get(day) ?? []
    const dayDeposits = roundMoney(dayTransactions
      .filter(({ type }) => type === 'deposit')
      .reduce((sum, { amount }) => sum + amount, 0))
    const dayWithdrawals = roundMoney(dayTransactions
      .filter(({ type }) => type === 'withdrawal')
      .reduce((sum, { amount }) => sum + amount, 0))

    parkedSurplus = roundMoney(parkedSurplus + dayDeposits)
    periodDeposits = roundMoney(periodDeposits + dayDeposits)
    if (dayWithdrawals > parkedSurplus + 0.005) {
      errors.push(`Withdrawal on ${fromEpochDay(day)} exceeds the available parked surplus.`)
      break
    }
    parkedSurplus = roundMoney(parkedSurplus - dayWithdrawals)
    periodWithdrawals = roundMoney(periodWithdrawals + dayWithdrawals)

    const netUtilized = roundMoney(Math.max(0, drawingPower - parkedSurplus))
    if (netUtilized > 0.005) lastPositiveDay = day
    if (parkedSurplus > drawingPower && !excessWarned) {
      warnings.push('Parked surplus exceeds drawing power; the excess remains withdrawable but earns no additional interest benefit.')
      excessWarned = true
    }

    if (paymentEvent) {
      const { row, index } = paymentEvent
      const fee = annualFee + (index === 0 ? scenario.od.setupFee : 0)
      totalFees = roundMoney(totalFees + fee)
      schedule.push({
        month: index + 1,
        date: row.date,
        annualRate: row.annualRate + scenario.od.premiumRate,
        payment,
        principalReduction,
        interest: postedInterest,
        prepayment,
        deposit: periodDeposits,
        withdrawal: periodWithdrawals,
        fee,
        drawingPower,
        parkedSurplus,
        availableWithdrawal: parkedSurplus,
        netUtilized,
      })
      periodDeposits = 0
      periodWithdrawals = 0
      activeRate = (standardSchedule[index + 1]?.annualRate ?? row.annualRate) + scenario.od.premiumRate
    }

    accruedInterest += netUtilized * (activeRate / 100 / 365)
  }

  const endingNetUtilized = Math.max(0, drawingPower - parkedSurplus)
  const netDebtFreeDate = errors.length > 0 || endingNetUtilized > 0.005
    ? null
    : lastPositiveDay === null
      ? scenario.startDate
      : fromEpochDay(lastPositiveDay + 1)
  return { schedule, errors, warnings, totalFees, netDebtFreeDate }
}

const emptyCalculationResult = (
  scenario: LoanScenario,
  issues: ValidationIssue[],
  amounts: Pick<CalculationResult,
    'loanAmount' | 'downPaymentAmount' | 'processingFeeAmount' | 'oneTimeExpensesAmount'
    | 'monthlyOwnershipCost' | 'ownershipCostOverOriginalTenure' | 'upfrontCash'>,
): CalculationResult => ({
  scenario,
  ...amounts,
  standard: {
    initialEmi: 0,
    totalInterest: 0,
    totalPrepayments: 0,
    payoffDate: scenario.startDate,
    schedule: [],
    totalModelledOutflow: 0,
  },
  od: {
    enabled: scenario.od.enabled,
    effectiveInitialRate: 0,
    totalInterest: 0,
    totalFees: 0,
    feeAdjustedSavings: 0,
    contractualPayoffDate: scenario.startDate,
    netDebtFreeDate: null,
    endingParkedSurplus: 0,
    schedule: [],
    totalModelledOutflow: 0,
  },
  warnings: [],
  issues,
  errors: issues.map(({ message }) => message),
})

export const calculateLoan = (scenario: LoanScenario): CalculationResult => {
  const validationIssues = validateScenario(scenario)
  const finite = (value: number) => Number.isFinite(value) ? value : 0
  const safeAmountFromMode = (value: number, mode: MoneyMode, base: number) =>
    finite(amountFromMode(finite(value), mode, finite(base)))
  const downPaymentAmount = safeAmountFromMode(scenario.downPayment, scenario.downPaymentMode, scenario.homeValue)
  const loanAmount = finite(roundMoney(finite(scenario.homeValue) + finite(scenario.loanInsurance) - downPaymentAmount))
  if (loanAmount > MAX_MONEY) {
    validationIssues.push({ field: 'loanAmount', message: 'Loan amount must not exceed ₹100 crore.' })
  }
  const processingFeeAmount = safeAmountFromMode(scenario.processingFee, scenario.processingFeeMode, loanAmount)
  const oneTimeExpensesAmount = safeAmountFromMode(scenario.oneTimeExpenses, scenario.oneTimeExpensesMode, scenario.homeValue)
  const propertyTax = safeAmountFromMode(scenario.propertyTaxAnnual, scenario.propertyTaxMode, scenario.homeValue)
  const homeInsurance = safeAmountFromMode(scenario.homeInsuranceAnnual, scenario.homeInsuranceMode, scenario.homeValue)
  const monthlyOwnershipCost = finite(roundMoney(propertyTax / 12 + homeInsurance / 12 + finite(scenario.maintenanceMonthly)))
  const ownershipCostOverOriginalTenure = finite(roundMoney(monthlyOwnershipCost * finite(scenario.tenureMonths)))
  const upfrontCash = roundMoney(downPaymentAmount + processingFeeAmount + oneTimeExpensesAmount)
  const amounts = {
    loanAmount,
    downPaymentAmount,
    processingFeeAmount,
    oneTimeExpensesAmount,
    monthlyOwnershipCost,
    ownershipCostOverOriginalTenure,
    upfrontCash,
  }
  if (validationIssues.length > 0) {
    const nonNegativeFinite = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0
    return emptyCalculationResult(scenario, validationIssues, {
      loanAmount: nonNegativeFinite(amounts.loanAmount),
      downPaymentAmount: nonNegativeFinite(amounts.downPaymentAmount),
      processingFeeAmount: nonNegativeFinite(amounts.processingFeeAmount),
      oneTimeExpensesAmount: nonNegativeFinite(amounts.oneTimeExpensesAmount),
      monthlyOwnershipCost: nonNegativeFinite(amounts.monthlyOwnershipCost),
      ownershipCostOverOriginalTenure: nonNegativeFinite(amounts.ownershipCostOverOriginalTenure),
      upfrontCash: nonNegativeFinite(amounts.upfrontCash),
    })
  }
  const amortization = buildAmortizationSchedule({
    principal: Math.max(0, loanAmount),
    annualRate: scenario.annualRate,
    tenureMonths: scenario.tenureMonths,
    startDate: scenario.startDate,
    prepayments: scenario.prepayments,
    rateChanges: scenario.rateChanges,
    balloonAmount: 0,
  })
  const standard = {
    ...amortization,
    schedule: amortization.rows.map<ScheduleRow>((row) => ({ ...row, ownershipCost: monthlyOwnershipCost })),
  }
  const calculatedPayoffDay = toEpochDay(standard.schedule.at(-1)?.date ?? scenario.startDate)
  const postPayoffErrors = scenario.od.enabled && scenario.od.transactionsEnabled
    ? scenario.od.transactions
        .filter((transaction) => toEpochDay(transaction.date) >= calculatedPayoffDay)
        .map((transaction) => `OD transaction ${transaction.date} must occur before the calculated payoff date.`)
    : []
  const openingSurplusAmount = amountFromMode(scenario.od.openingSurplus, scenario.od.openingSurplusMode, loanAmount)
  const od = buildOdSchedule(scenario, Math.max(0, loanAmount), standard.schedule, openingSurplusAmount)
  const engineIssues = [...standard.errors, ...postPayoffErrors, ...od.errors]
    .filter((message) => !validationIssues.some((issue) => issue.message === message))
    .map((message) => ({ field: 'scenario', message }))
  const issues = [...validationIssues, ...engineIssues]
  const errors = issues.map(({ message }) => message)
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
    issues,
    errors,
  }
}

const currencyFormatters = new Map<number, Intl.NumberFormat>()

export const formatCurrency = (value: number, maximumFractionDigits = 0) => {
  let formatter = currencyFormatters.get(maximumFractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits,
    })
    currencyFormatters.set(maximumFractionDigits, formatter)
  }
  return formatter.format(Number.isFinite(value) ? value : 0)
}
