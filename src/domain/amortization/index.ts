import type { Prepayment, RateChange } from '../loan'

export interface AmortizationInput {
  principal: number
  annualRate: number
  tenureMonths: number
  startDate: string
  prepayments: Prepayment[]
  rateChanges: RateChange[]
  balloonAmount: number
}

export interface AmortizationRow {
  month: number
  date: string
  annualRate: number
  emi: number
  principal: number
  interest: number
  prepayment: number
  balance: number
}

export interface AmortizationResult {
  initialEmi: number
  totalInterest: number
  totalPrepayments: number
  payoffDate: string
  rows: AmortizationRow[]
  errors: string[]
  warnings: string[]
}

const DAY_MS = 86_400_000
const MAX_MONTHS = 600

export const roundMoney = (value: number) => {
  const scaled = value * 100
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled))
  return (scaled >= 0
    ? Math.floor(scaled + 0.5 + tolerance)
    : Math.ceil(scaled - 0.5 - tolerance)) / 100
}

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

export const calculateBalloonEmi = (
  principal: number,
  annualRate: number,
  months: number,
  balloonAmount: number,
) => {
  if (balloonAmount === 0) return calculateEmi(principal, annualRate, months)
  if (principal <= 0 || months <= 0) return 0
  const monthlyRate = annualRate / 100 / 12
  if (monthlyRate === 0) return roundMoney((principal - balloonAmount) / months)
  const factor = (1 + monthlyRate) ** months
  return roundMoney(((principal * factor - balloonAmount) * monthlyRate) / (factor - 1))
}

const prepaymentDue = (item: Prepayment, paymentCycle: number, startCycle: number) => {
  const delta = paymentCycle - startCycle
  if (delta < 0) return false
  const interval = item.frequency === 'once' ? 0
    : item.frequency === 'monthly' ? 1
      : item.frequency === 'quarterly' ? 3
        : 12
  return interval === 0 ? delta === 0 : delta % interval === 0
}

const fixedEmiCycles = (
  balance: number,
  annualRate: number,
  emi: number,
  balloonAmount: number,
  maxCycles: number,
) => {
  let projectedBalance = balance
  for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    const interest = roundMoney(projectedBalance * (annualRate / 1200))
    const amortizingBalance = roundMoney(Math.max(0, projectedBalance - balloonAmount))
    const principal = roundMoney(Math.min(amortizingBalance, Math.max(0, emi - interest)))
    if (principal <= 0 && amortizingBalance > 0.005) return null
    if (principal >= amortizingBalance - 0.005) return cycle
    projectedBalance = roundMoney(projectedBalance - principal)
  }
  return null
}

export const buildAmortizationSchedule = (input: AmortizationInput): AmortizationResult => {
  const errors: string[] = []
  const warnings: string[] = []
  const rows: AmortizationRow[] = []
  if (!Number.isFinite(input.balloonAmount) || input.balloonAmount < 0 || input.balloonAmount >= input.principal) {
    return {
      initialEmi: 0,
      totalInterest: 0,
      totalPrepayments: 0,
      payoffDate: input.startDate,
      rows,
      errors: ['Balloon amount must be finite, at least ₹0, and below the principal.'],
      warnings: [],
    }
  }
  const changes = new Map(input.rateChanges.map((change) => [change.date, change]))
  const prepayments = input.prepayments
    .map((item) => ({ item, startCycle: cycleIndex(input.startDate, item.date) }))
    .filter((entry): entry is { item: Prepayment, startCycle: number } => entry.startCycle !== null)
  let annualRate = input.annualRate
  let balance = input.principal
  let emi = calculateBalloonEmi(balance, annualRate, input.tenureMonths, input.balloonAmount)
  const initialEmi = emi
  let extensionAllowed = false
  let finalPaymentMonth = input.tenureMonths - 1

  for (let month = 0; month < MAX_MONTHS && balance > 0.005; month += 1) {
    const periodStart = addMonths(input.startDate, month)
    const paymentDate = addMonths(input.startDate, month + 1)
    const change = changes.get(periodStart)
    if (change) {
      annualRate = change.annualRate
      extensionAllowed = change.mode === 'keep-emi'
      if (change.mode === 'keep-tenure') {
        finalPaymentMonth = Math.max(month, input.tenureMonths - 1)
        const remaining = finalPaymentMonth - month + 1
        emi = calculateBalloonEmi(balance, annualRate, remaining, input.balloonAmount)
      } else if (input.balloonAmount > 0) {
        const remaining = fixedEmiCycles(
          balance,
          annualRate,
          emi,
          input.balloonAmount,
          MAX_MONTHS - month,
        )
        finalPaymentMonth = remaining === null ? MAX_MONTHS : month + remaining - 1
      }
    }

    const interest = roundMoney(balance * (annualRate / 1200))
    if (emi <= interest && balance > emi) {
      errors.push(`EMI is insufficient after the rate change effective ${periodStart}. Minimum EMI is ${roundMoney(interest + 0.01)}.`)
      break
    }
    const amortizingBalance = roundMoney(Math.max(0, balance - input.balloonAmount))
    const isBalloonPayoff = input.balloonAmount > 0
      && (month === finalPaymentMonth || amortizingBalance <= 0.005)
    const isFinalFixedTenurePayment = isBalloonPayoff
      || (input.balloonAmount === 0 && !extensionAllowed && month === input.tenureMonths - 1)
    const principal = roundMoney(
      isFinalFixedTenurePayment
        ? balance
        : Math.min(input.balloonAmount > 0 ? amortizingBalance : balance, Math.max(0, emi - interest)),
    )
    const duePrepayment = roundMoney(
      prepayments
        .filter(({ item, startCycle }) => prepaymentDue(item, month + 1, startCycle))
        .reduce((sum, { item }) => sum + item.amount, 0),
    )
    const prepaymentLimit = Math.max(0, balance - principal - input.balloonAmount)
    const prepayment = roundMoney(Math.min(prepaymentLimit, duePrepayment))
    if (input.balloonAmount > 0 && duePrepayment > prepaymentLimit + 0.005) {
      warnings.push(`Prepayment on ${paymentDate} was capped to preserve the contractual balloon.`)
    }
    balance = roundMoney(Math.max(0, balance - principal - prepayment))
    rows.push({
      month: month + 1,
      date: paymentDate,
      annualRate,
      emi: roundMoney(interest + principal),
      principal,
      interest,
      prepayment,
      balance,
    })
  }

  if (balance > 0.005 && errors.length === 0) errors.push('The loan did not amortize within the 600-month calculation limit.')
  return {
    initialEmi,
    totalInterest: rows.reduce((sum, row) => sum + row.interest, 0),
    totalPrepayments: rows.reduce((sum, row) => sum + row.prepayment, 0),
    payoffDate: rows.at(-1)?.date ?? input.startDate,
    rows,
    errors,
    warnings,
  }
}
