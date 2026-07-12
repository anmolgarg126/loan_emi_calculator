import { describe, expect, it } from 'vitest'
import { calculateSuite, defaultSuiteScenario } from './index'
import type { SuiteScenario } from './types'

const medianRuntime = (scenario: SuiteScenario) => {
  calculateSuite(scenario)
  const samples = Array.from({ length: 25 }, () => {
    const start = performance.now()
    calculateSuite(scenario)
    return performance.now() - start
  }).sort((left, right) => left - right)
  return { median: samples[12]!, maximum: samples.at(-1)! }
}

describe('calculator performance guard', () => {
  it('keeps representative and supported-maximum calculations below 100 ms', () => {
    const home = defaultSuiteScenario('home')
    const car = defaultSuiteScenario('car')
    const personal = defaultSuiteScenario('personal')
    const education = defaultSuiteScenario('education')
    const fixtures: Record<string, SuiteScenario> = {
      generic: defaultSuiteScenario('generic'),
      homeMaximum: { ...home, value: { ...home.value, homeValue: 1_000_000_000, downPayment: 0, downPaymentMode: 'amount', annualRate: 50, tenureMonths: 480, processingFee: 0, oneTimeExpenses: 0, propertyTaxAnnual: 0, homeInsuranceAnnual: 0, maintenanceMonthly: 0, od: { ...home.value.od, enabled: true, premiumRate: 0 } } },
      car: { ...car, value: { ...car.value, vehiclePrice: 10_000_000, annualRate: 20, tenureMonths: 120, ownershipMonths: 120 } },
      personal: { ...personal, value: { ...personal.value, principal: 10_000_000, quotedAnnualRate: 30, tenureMonths: 84 } },
      education: { ...education, value: { ...education.value, courseCost: 10_000_000, ownContribution: 2_000_000, disbursements: [{ id: 'course', date: education.value.startDate, amount: 8_000_000 }], studyAnnualRate: 20, studyMonths: 48, moratoriumMonths: 12, repaymentAnnualRate: 20, repaymentTenureMonths: 180 } },
    }
    const timings = Object.fromEntries(Object.entries(fixtures).map(([name, scenario]) => [name, medianRuntime(scenario)]))
    console.info('calculator performance ms', timings)
    Object.values(timings).forEach(({ maximum }) => expect(maximum).toBeLessThan(100))
  })
})
