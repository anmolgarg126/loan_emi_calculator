import { describe, expect, it } from 'vitest'
import { addMonths, roundMoney } from '../loan'
import { buildCostBreakdown } from './cost-breakdown'
import { calculateSuite, defaultSuiteScenario } from './index'

const scheduledRepayment = (rows: Array<{ payment: number; prepayment: number }>) =>
  roundMoney(rows.reduce((sum, row) => sum + row.payment + row.prepayment, 0))

describe('cost breakdown', () => {
  it('reconciles Generic fees and keeps prepayment separate from cost', () => {
    const base = defaultSuiteScenario('generic').value
    const result = calculateSuite({
      kind: 'generic',
      value: {
        ...base,
        processingFee: 2_500,
        prepayments: [{ id: 'extra', date: addMonths(base.startDate, 1), amount: 12_000, frequency: 'yearly' }],
      },
    })

    const costs = buildCostBreakdown(result)

    expect(costs.composition).toEqual([
      { label: 'Base principal', value: base.principal },
      { label: 'Total loan amount', value: base.principal },
    ])
    expect(costs.sections.fees).toMatchObject({ oneTimeCost: 2_500, totalCost: 2_500 })
    expect(costs.sections.repayment).toMatchObject({ monthlyCashFlow: 1_000 })
    expect(costs.overall.otherCharges).toBe(2_500)
    expect(costs.overall.totalLoanPayable).toBe(result.native.totalRepayment)
    expect(costs.overall.totalOverallCost).toBe(result.native.totalRepayment)
    expect(costs.overall.totalMonthlyCost).toBe(costs.overall.emi)
  })

  it('reconciles Home ownership costs and excludes OD liquidity from cost', () => {
    const base = defaultSuiteScenario('home').value
    const result = calculateSuite({
      kind: 'home',
      value: {
        ...base,
        od: { ...base.od, enabled: true, setupFee: 5_000, annualFee: 1_200, monthlyContribution: 20_000 },
      },
    })

    const costs = buildCostBreakdown(result)

    expect(costs.composition.at(-1)).toEqual({ label: 'Total loan amount', value: result.native.loanAmount })
    expect(costs.sections.ownership).toMatchObject({
      monthlyCost: result.native.monthlyOwnershipCost,
      oneTimeCost: roundMoney(result.native.processingFeeAmount + result.native.oneTimeExpensesAmount),
    })
    expect(costs.sections.od).toMatchObject({ monthlyCost: 100, oneTimeCost: 5_000, monthlyCashFlow: 20_000 })
    expect(costs.overall.totalMonthlyCost).toBe(roundMoney(result.native.standard.initialEmi + result.native.monthlyOwnershipCost))
    expect(costs.overall.totalOverallCost).toBe(result.native.standard.totalModelledOutflow)
    expect(costs.overall.otherCharges).toBe(roundMoney(
      result.native.processingFeeAmount + result.native.oneTimeExpensesAmount + result.native.ownershipCostOverOriginalTenure,
    ))
    expect(costs.comparison).toEqual({ label: 'OD overall cost', value: result.native.od.totalModelledOutflow })
  })

  it('reconciles Car financed charges, balloon, and resale without double-counting', () => {
    const base = defaultSuiteScenario('car').value
    const result = calculateSuite({
      kind: 'car',
      value: {
        ...base,
        registrationFees: 50_000,
        financeRegistrationFees: true,
        financedInsurance: 20_000,
        processingFee: 2_000,
        balloonAmount: 100_000,
        expectedResaleValue: 300_000,
      },
    })

    const costs = buildCostBreakdown(result)
    const repayment = scheduledRepayment(result.view.schedule)

    expect(costs.composition).toEqual([
      { label: 'Base vehicle amount financed', value: 800_000 },
      { label: 'Financed one-time charges', value: 70_000 },
      { label: 'Total financed principal', value: result.native.financedPrincipal },
    ])
    expect(costs.sections.balloon).toMatchObject({ oneTimeCashFlow: 100_000, proceeds: 300_000 })
    expect(costs.overall.totalLoanPayable).toBe(roundMoney(repayment + 2_000))
    expect(costs.overall.totalOverallCost).toBe(roundMoney(repayment + 2_000 + result.native.downPaymentAmount))
    expect(costs.overall.netOverallCost).toBe(roundMoney(costs.overall.totalOverallCost - 300_000))
  })

  it('reconciles Personal deductions within principal instead of adding them twice', () => {
    const base = defaultSuiteScenario('personal').value
    const result = calculateSuite({
      kind: 'personal',
      value: { ...base, processingFee: 2, processingFeeMode: 'percent', insuranceDeduction: 5_000 },
    })

    const costs = buildCostBreakdown(result)

    expect(costs.composition).toEqual([
      { label: 'Net amount received', value: result.native.netDisbursed },
      { label: 'Upfront deductions within principal', value: result.native.totalDeductions },
      { label: 'Total requested principal', value: base.principal },
    ])
    expect(costs.sections.deductions!.oneTimeCost).toBe(result.native.totalDeductions)
    expect(costs.overall.otherCharges).toBe(result.native.totalDeductions)
    expect(costs.overall.totalLoanPayable).toBe(result.native.totalRepayment)
    expect(costs.overall.totalOverallCost).toBe(result.native.totalRepayment)
  })

  it('reconciles Education capitalized interest and lifecycle cost', () => {
    const base = defaultSuiteScenario('education').value
    const result = calculateSuite({ kind: 'education', value: { ...base, processingFee: 5_000 } })

    const costs = buildCostBreakdown(result)
    const totalInterest = roundMoney(
      result.native.servicedInterest + result.native.capitalizedInterest + result.native.repaymentInterest,
    )

    expect(costs.composition).toEqual([
      { label: 'Original principal disbursed', value: result.native.totalDisbursed },
      { label: 'Capitalized interest', value: result.native.capitalizedInterest },
      { label: 'Repayment-start principal', value: result.native.repaymentPrincipal },
    ])
    expect(costs.overall.interest).toBe(totalInterest)
    expect(costs.overall.totalLoanPayable).toBe(result.native.totalCost)
    expect(costs.overall.totalOverallCost).toBe(roundMoney(result.native.totalCost + base.ownContribution))
    expect(costs.overall.tenureMonths).toBe(base.studyMonths + base.moratoriumMonths + base.repaymentTenureMonths)
  })
})
