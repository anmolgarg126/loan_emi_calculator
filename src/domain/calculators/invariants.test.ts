import { describe, expect, it } from 'vitest'
import { roundMoney } from '../loan'
import { calculateSuite, defaultSuiteScenario } from './index'
import type { CalculatorKind, SuiteResult, SuiteScenario } from './types'

const random = (() => {
  let state = 0x5eed1234
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
})()
const between = (minimum: number, maximum: number) => minimum + random() * (maximum - minimum)
const integer = (minimum: number, maximum: number) => Math.floor(between(minimum, maximum + 1))

const scenarioFor = (kind: CalculatorKind): SuiteScenario => {
  switch (kind) {
    case 'generic': {
      const base = defaultSuiteScenario('generic')
      return { ...base, value: { ...base.value, principal: roundMoney(between(10_000, 10_000_000)), annualRate: between(0, 20), tenureMonths: integer(12, 180) } }
    }
    case 'home': {
      const base = defaultSuiteScenario('home')
      return { ...base, value: { ...base.value, homeValue: roundMoney(between(500_000, 50_000_000)), downPayment: between(0, 40), annualRate: between(0, 20), tenureMonths: integer(12, 360), processingFee: 0, oneTimeExpenses: 0, propertyTaxAnnual: 0, homeInsuranceAnnual: 0, maintenanceMonthly: 0 } }
    }
    case 'car': {
      const base = defaultSuiteScenario('car')
      const tenureMonths = integer(12, 120)
      return { ...base, value: { ...base.value, vehiclePrice: roundMoney(between(100_000, 20_000_000)), downPayment: between(0, 50), annualRate: between(0, 20), tenureMonths, ownershipMonths: tenureMonths } }
    }
    case 'personal': {
      const base = defaultSuiteScenario('personal')
      return { ...base, value: { ...base.value, principal: roundMoney(between(10_000, 5_000_000)), quotedAnnualRate: between(0, 30), quotationMode: random() > .5 ? 'reducing' : 'flat', tenureMonths: integer(6, 84) } }
    }
    case 'education': {
      const base = defaultSuiteScenario('education')
      const courseCost = roundMoney(between(100_000, 10_000_000))
      const ownContribution = roundMoney(courseCost * .2)
      return { ...base, value: { ...base.value, courseCost, ownContribution, disbursements: [{ id: 'course', date: base.value.startDate, amount: roundMoney(courseCost - ownContribution) }], studyAnnualRate: between(0, 20), studyMonths: integer(12, 48), moratoriumMonths: integer(0, 12), servicingMode: random() > .5 ? 'none' : 'full-interest', repaymentAnnualRate: between(0, 20), repaymentTenureMonths: integer(24, 180) } }
    }
  }
}

const expectedPrincipal = (result: SuiteResult) => {
  switch (result.kind) {
    case 'generic': return result.scenario.principal
    case 'home': return result.native.loanAmount
    case 'car': return result.native.financedPrincipal
    case 'personal': return result.scenario.principal
    case 'education': return result.native.repaymentPrincipal
  }
}
const expectedInterest = (result: SuiteResult) => {
  switch (result.kind) {
    case 'generic': return result.native.totalInterest
    case 'home': return result.native.standard.totalInterest
    case 'car': return result.native.totalInterest
    case 'personal': return result.native.totalInterest
    case 'education': return result.native.repaymentInterest
  }
}

describe('deterministic calculator invariants', () => {
  it.each(['generic', 'home', 'car', 'personal', 'education'] as const)(
    'reconciles 1,000 fixed-seed valid %s scenarios',
    (kind) => {
      for (let index = 0; index < 1_000; index += 1) {
        const result = calculateSuite(scenarioFor(kind))
        expect(result.view.errors).toEqual([])
        const schedule = result.view.schedule
        expect(schedule.length).toBeGreaterThan(0)
        expect(schedule.length).toBeLessThanOrEqual(600)
        expect(schedule.at(-1)?.balance).toBe(0)
        expect(schedule.every((row) => Object.values(row).filter((value) => typeof value === 'number').every(Number.isFinite))).toBe(true)
        expect(schedule.every((row) => row.balance >= 0 && row.principal >= 0 && row.interest >= 0 && row.prepayment >= 0)).toBe(true)
        expect(schedule.every((row, position) => position === 0 || row.balance <= schedule[position - 1]!.balance + .005)).toBe(true)
        expect(roundMoney(schedule.reduce((sum, row) => sum + row.principal + row.prepayment, 0))).toBe(roundMoney(expectedPrincipal(result)))
        expect(roundMoney(schedule.reduce((sum, row) => sum + row.interest, 0))).toBe(roundMoney(expectedInterest(result)))
      }
    },
  )
})
