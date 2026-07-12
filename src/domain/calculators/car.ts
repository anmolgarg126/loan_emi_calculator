import { buildAmortizationSchedule } from '../amortization'
import { addMonths, cycleIndex, defaultScenario, roundMoney, toEpochDay } from '../loan'
import type { ValidationIssue } from '../loan'
import type { CarResult, CarScenario, UnifiedScheduleRow } from './types'

const MAX_MONEY = 1_000_000_000
const MAX_EVENTS = 100

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const duplicates = (values: string[]) => new Set(values).size !== values.length

export const defaultCarScenario = (): CarScenario => ({
  vehiclePrice: 1_000_000,
  downPayment: 20,
  downPaymentMode: 'percent',
  registrationFees: 0,
  financeRegistrationFees: false,
  financedInsurance: 0,
  annualRate: 10,
  tenureMonths: 60,
  startDate: defaultScenario().startDate,
  processingFee: 0,
  balloonAmount: 0,
  expectedResaleValue: 0,
  ownershipMonths: 60,
  prepayments: [],
  rateChanges: [],
})

const invalidResult = (scenario: CarScenario, issues: ValidationIssue[], warnings: string[] = []): CarResult => ({
  financedPrincipal: 0,
  downPaymentAmount: 0,
  initialEmi: 0,
  balloonAmount: 0,
  totalInterest: 0,
  cashOutflowThroughHorizon: 0,
  remainingLoanSettlement: 0,
  netOwnershipCost: 0,
  payoffDate: typeof scenario?.startDate === 'string' ? scenario.startDate : '',
  schedule: [],
  issues,
  errors: issues.map(({ message }) => message),
  warnings,
})

export const calculateCar = (scenario: CarScenario): CarResult => {
  const issues: ValidationIssue[] = []
  const add = (field: string, message: string) => issues.push({ field, message })
  const money = (field: keyof CarScenario, positive = false) => {
    const value = scenario?.[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_MONEY || (positive && value === 0)) {
      add(field, `${field} must be ${positive ? 'above ₹0' : 'between ₹0'} and ₹100 crore.`)
    }
  }

  money('vehiclePrice', true)
  money('downPayment')
  money('registrationFees')
  money('financedInsurance')
  money('processingFee')
  money('balloonAmount')
  money('expectedResaleValue')
  if (scenario?.downPaymentMode !== 'amount' && scenario?.downPaymentMode !== 'percent') add('downPaymentMode', 'Mode must be amount or percent.')
  if (scenario?.downPaymentMode === 'percent' && scenario.downPayment > 100) add('downPayment', 'Down payment percentage must be between 0% and 100%.')
  if (scenario?.downPaymentMode === 'amount' && scenario.downPayment > scenario.vehiclePrice) add('downPayment', 'Down payment cannot exceed vehicle price.')
  if (typeof scenario?.financeRegistrationFees !== 'boolean') add('financeRegistrationFees', 'Registration financing choice must be true or false.')
  if (!Number.isFinite(scenario?.annualRate) || scenario.annualRate < 0 || scenario.annualRate > 50) add('annualRate', 'Interest rate must be between 0% and 50%.')
  if (!Number.isInteger(scenario?.tenureMonths) || scenario.tenureMonths < 1 || scenario.tenureMonths > 480) add('tenureMonths', 'Tenure must be between 1 and 480 months.')
  if (!Number.isInteger(scenario?.ownershipMonths) || scenario.ownershipMonths < 1 || scenario.ownershipMonths > scenario.tenureMonths) add('ownershipMonths', 'Ownership horizon must be between 1 month and the loan tenure.')
  if (typeof scenario?.startDate !== 'string' || !Number.isFinite(toEpochDay(scenario.startDate))) add('startDate', 'Start date must be a valid calendar date.')
  if (!Array.isArray(scenario?.prepayments)) add('prepayments', 'Prepayments must be a list.')
  if (!Array.isArray(scenario?.rateChanges)) add('rateChanges', 'Rate changes must be a list.')

  const validCycle = (date: unknown) => typeof date === 'string'
    && typeof scenario?.startDate === 'string'
    && cycleIndex(scenario.startDate, date) !== null
  const itemField = (list: string, id: unknown, index: number, field: string) =>
    `${list}.${typeof id === 'string' && id.trim() ? id : index}.${field}`
  const prepayments: unknown[] = Array.isArray(scenario?.prepayments) ? scenario.prepayments : []
  const validPrepayments = prepayments.filter(isRecord)
  const prepaymentIds = validPrepayments.map(({ id }) => id)
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
  if (prepayments.length > MAX_EVENTS) add('prepayments', 'Prepayments are limited to 100 entries.')
  if (duplicates(prepaymentIds)) add('prepayments', 'Prepayment IDs must be unique.')
  prepayments.forEach((item, index) => {
    if (!isRecord(item)) {
      add(`prepayments.${index}`, 'Prepayment entry must be an object.')
      return
    }
    if (typeof item.id !== 'string' || !item.id.trim()) add(itemField('prepayments', item.id, index, 'id'), 'Prepayment IDs must not be blank.')
    if (!validCycle(item.date)) add(itemField('prepayments', item.id, index, 'date'), 'Prepayment must fall on an EMI date on or after the first EMI date.')
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 0 || item.amount > MAX_MONEY) {
      add(itemField('prepayments', item.id, index, 'amount'), 'Prepayment must be between ₹0 and ₹100 crore.')
    }
    if (item.frequency !== 'once' && item.frequency !== 'monthly' && item.frequency !== 'quarterly' && item.frequency !== 'yearly') {
      add(itemField('prepayments', item.id, index, 'frequency'), 'Prepayment frequency is invalid.')
    }
  })

  const rateChanges: unknown[] = Array.isArray(scenario?.rateChanges) ? scenario.rateChanges : []
  const validRateChanges = rateChanges.filter(isRecord)
  const rateIds = validRateChanges.map(({ id }) => id)
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
  if (rateChanges.length > MAX_EVENTS) add('rateChanges', 'Rate changes are limited to 100 entries.')
  if (duplicates(rateIds)) add('rateChanges', 'Rate-change IDs must be unique.')
  rateChanges.forEach((item, index) => {
    if (!isRecord(item)) {
      add(`rateChanges.${index}`, 'Rate change entry must be an object.')
      return
    }
    if (typeof item.id !== 'string' || !item.id.trim()) add(itemField('rateChanges', item.id, index, 'id'), 'Rate-change IDs must not be blank.')
    if (!validCycle(item.date)) add(itemField('rateChanges', item.id, index, 'date'), 'Rate change must fall on an EMI date on or after the first EMI date.')
    if (typeof item.annualRate !== 'number' || !Number.isFinite(item.annualRate) || item.annualRate < 0 || item.annualRate > 50) {
      add(itemField('rateChanges', item.id, index, 'annualRate'), 'Changed rate must be between 0% and 50%.')
    }
    if (item.mode !== 'keep-emi' && item.mode !== 'keep-tenure') add(itemField('rateChanges', item.id, index, 'mode'), 'Rate-change mode must be keep-emi or keep-tenure.')
  })
  const rateDates = validRateChanges.map(({ date }) => date).filter((date): date is string => validCycle(date))
  new Set(rateDates.filter((date, index) => rateDates.indexOf(date) !== index)).forEach((date) => {
    add('rateChanges', `Only one rate change may apply on ${date}.`)
  })

  if (issues.length > 0) return invalidResult(scenario, issues)

  const downPaymentAmount = scenario.downPaymentMode === 'percent'
    ? roundMoney(scenario.vehiclePrice * scenario.downPayment / 100)
    : scenario.downPayment
  const financedPrincipal = roundMoney(
    scenario.vehiclePrice - downPaymentAmount
      + (scenario.financeRegistrationFees ? scenario.registrationFees : 0)
      + scenario.financedInsurance,
  )
  if (!Number.isFinite(financedPrincipal) || financedPrincipal <= 0 || financedPrincipal > MAX_MONEY) {
    return invalidResult(scenario, [{
      field: 'financedPrincipal',
      message: 'Financed principal must be above ₹0 and at most ₹100 crore.',
    }])
  }
  if (scenario.balloonAmount >= financedPrincipal) {
    return invalidResult(scenario, [{ field: 'balloonAmount', message: 'Balloon amount must be below the financed principal.' }])
  }

  const engineStartDate = addMonths(scenario.startDate, -1)
  const engineRateDates = new Map<string, string>()
  const amortization = buildAmortizationSchedule({
    principal: financedPrincipal,
    annualRate: scenario.annualRate,
    tenureMonths: scenario.tenureMonths,
    startDate: engineStartDate,
    prepayments: scenario.prepayments.map((item) => ({
      ...item,
      date: addMonths(engineStartDate, (cycleIndex(scenario.startDate, item.date) ?? -1) + 1),
    })),
    rateChanges: scenario.rateChanges.map((item) => {
      const date = addMonths(engineStartDate, cycleIndex(scenario.startDate, item.date)!)
      engineRateDates.set(date, item.date)
      return { ...item, date }
    }),
    balloonAmount: scenario.balloonAmount,
  })
  if (amortization.errors.length > 0) {
    const errors = amortization.errors.map((message) => {
      let publicMessage = message
      engineRateDates.forEach((publicDate, engineDate) => {
        publicMessage = publicMessage.replace(engineDate, publicDate)
      })
      return publicMessage
    })
    return invalidResult(scenario, errors.map((message) => ({ field: 'scenario', message })), amortization.warnings)
  }

  scenario.prepayments.forEach((item, index) => {
    if ((cycleIndex(scenario.startDate, item.date) ?? -1) >= amortization.rows.length) {
      add(itemField('prepayments', item.id, index, 'date'), 'Prepayment must not be after the loan payoff date.')
    }
  })
  scenario.rateChanges.forEach((item, index) => {
    if ((cycleIndex(scenario.startDate, item.date) ?? -1) >= amortization.rows.length) {
      add(itemField('rateChanges', item.id, index, 'date'), 'Rate change must not be after the loan payoff date.')
    }
  })
  if (issues.length > 0) return invalidResult(scenario, issues, amortization.warnings)

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
  const horizonRows = schedule.slice(0, scenario.ownershipMonths)
  const paymentsThroughHorizon = horizonRows.reduce((sum, row) => sum + row.payment + row.prepayment, 0)
  const remainingLoanSettlement = scenario.ownershipMonths < schedule.length
    ? horizonRows.at(-1)?.balance ?? financedPrincipal
    : 0
  const upfront = downPaymentAmount + (scenario.financeRegistrationFees ? 0 : scenario.registrationFees) + scenario.processingFee
  const cashOutflowThroughHorizon = roundMoney(upfront + paymentsThroughHorizon + remainingLoanSettlement)

  return {
    financedPrincipal,
    downPaymentAmount,
    initialEmi: schedule[0]?.payment ?? amortization.initialEmi,
    balloonAmount: scenario.balloonAmount,
    totalInterest: roundMoney(amortization.totalInterest),
    cashOutflowThroughHorizon,
    remainingLoanSettlement: roundMoney(remainingLoanSettlement),
    netOwnershipCost: roundMoney(cashOutflowThroughHorizon - scenario.expectedResaleValue),
    payoffDate: schedule.at(-1)?.date ?? scenario.startDate,
    schedule,
    issues: [],
    errors: [],
    warnings: amortization.warnings,
  }
}
