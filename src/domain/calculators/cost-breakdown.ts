import { amountFromMode, roundMoney, type Prepayment } from '../loan'
import type { SuiteResult, UnifiedScheduleRow } from './types'

export interface SectionCostSummary {
  monthlyCost: number
  oneTimeCost: number
  totalCost: number
  monthlyCashFlow: number
  oneTimeCashFlow: number
  totalCashFlow: number
  proceeds: number
}

export interface CostBreakdown {
  composition: Array<{ label: string; value: number }>
  sections: Record<string, SectionCostSummary>
  overall: {
    emi: number
    recurringCost: number
    totalMonthlyCost: number
    plannedMonthlyCashFlow: number
    loanAmount: number
    interest: number
    otherCharges: number
    totalLoanPayable: number
    upfrontContribution: number
    totalOverallCost: number
    proceeds: number
    netOverallCost: number
    tenureMonths: number
  }
  comparison?: { label: string; value: number }
}

const section = (values: Partial<SectionCostSummary> = {}): SectionCostSummary => ({
  monthlyCost: 0,
  oneTimeCost: 0,
  totalCost: 0,
  monthlyCashFlow: 0,
  oneTimeCashFlow: 0,
  totalCashFlow: 0,
  proceeds: 0,
  ...values,
})

const scheduleRepayment = (rows: UnifiedScheduleRow[]) => roundMoney(
  rows.reduce((sum, row) => sum + row.payment + row.prepayment, 0),
)

const prepaymentSummary = (prepayments: Prepayment[], rows: UnifiedScheduleRow[]) => section({
  monthlyCashFlow: roundMoney(prepayments.reduce((sum, item) => sum + (
    item.frequency === 'monthly' ? item.amount
      : item.frequency === 'quarterly' ? item.amount / 3
        : item.frequency === 'yearly' ? item.amount / 12 : 0
  ), 0)),
  oneTimeCashFlow: roundMoney(prepayments
    .filter(({ frequency }) => frequency === 'once')
    .reduce((sum, { amount }) => sum + amount, 0)),
  totalCashFlow: roundMoney(rows.reduce((sum, row) => sum + row.prepayment, 0)),
})

const finalize = (values: Omit<CostBreakdown['overall'], 'totalMonthlyCost' | 'netOverallCost'>) => ({
  ...values,
  totalMonthlyCost: roundMoney(values.emi + values.recurringCost),
  netOverallCost: roundMoney(values.totalOverallCost - values.proceeds),
})

export const buildCostBreakdown = (result: SuiteResult): CostBreakdown => {
  switch (result.kind) {
    case 'generic': {
      const fees = section({ oneTimeCost: result.scenario.processingFee, totalCost: result.scenario.processingFee })
      const repayment = prepaymentSummary(result.scenario.prepayments, result.view.schedule)
      return {
        composition: [
          { label: 'Base principal', value: result.scenario.principal },
          { label: 'Total loan amount', value: result.scenario.principal },
        ],
        sections: { fees, repayment },
        overall: finalize({
          emi: result.native.initialEmi,
          recurringCost: 0,
          plannedMonthlyCashFlow: repayment.monthlyCashFlow,
          loanAmount: result.scenario.principal,
          interest: result.native.totalInterest,
          otherCharges: result.scenario.processingFee,
          totalLoanPayable: result.native.totalRepayment,
          upfrontContribution: 0,
          totalOverallCost: result.native.totalRepayment,
          proceeds: 0,
          tenureMonths: result.scenario.tenureMonths,
        }),
      }
    }
    case 'home': {
      const ownershipOneTime = roundMoney(result.native.processingFeeAmount + result.native.oneTimeExpensesAmount)
      const ownership = section({
        monthlyCost: result.native.monthlyOwnershipCost,
        oneTimeCost: ownershipOneTime,
        totalCost: roundMoney(ownershipOneTime + result.native.ownershipCostOverOriginalTenure),
      })
      const repayment = prepaymentSummary(result.scenario.prepayments, result.view.schedule)
      const openingSurplus = amountFromMode(
        result.scenario.od.openingSurplus,
        result.scenario.od.openingSurplusMode,
        result.native.loanAmount,
      )
      const datedNet = result.scenario.od.transactionsEnabled
        ? result.scenario.od.transactions.reduce((sum, item) => sum + (item.type === 'deposit' ? item.amount : -item.amount), 0)
        : 0
      const od = result.scenario.od.enabled ? section({
        monthlyCost: roundMoney(result.scenario.od.annualFee / 12),
        oneTimeCost: result.scenario.od.setupFee,
        totalCost: result.native.od.totalFees,
        monthlyCashFlow: result.scenario.od.monthlyContribution,
        oneTimeCashFlow: roundMoney(openingSurplus + datedNet),
        totalCashFlow: roundMoney(openingSurplus + result.native.od.schedule.reduce(
          (sum, row) => sum + row.deposit - row.withdrawal,
          0,
        )),
      }) : section()
      const otherCharges = roundMoney(
        result.native.processingFeeAmount
          + result.native.oneTimeExpensesAmount
          + result.native.ownershipCostOverOriginalTenure,
      )
      const breakdown: CostBreakdown = {
        composition: [
          { label: 'Base property amount financed', value: roundMoney(result.native.loanAmount - result.scenario.loanInsurance) },
          ...(result.scenario.loanInsurance ? [{ label: 'Financed one-time charges', value: result.scenario.loanInsurance }] : []),
          { label: 'Total loan amount', value: result.native.loanAmount },
        ],
        sections: { ownership, repayment, od },
        overall: finalize({
          emi: result.native.standard.initialEmi,
          recurringCost: result.native.monthlyOwnershipCost,
          plannedMonthlyCashFlow: roundMoney(repayment.monthlyCashFlow + od.monthlyCashFlow),
          loanAmount: result.native.loanAmount,
          interest: result.native.standard.totalInterest,
          otherCharges,
          totalLoanPayable: roundMoney(
            result.native.loanAmount + result.native.standard.totalInterest + result.native.processingFeeAmount,
          ),
          upfrontContribution: result.native.downPaymentAmount,
          totalOverallCost: result.native.standard.totalModelledOutflow,
          proceeds: 0,
          tenureMonths: result.scenario.tenureMonths,
        }),
      }
      if (result.scenario.od.enabled) {
        breakdown.comparison = { label: 'OD overall cost', value: result.native.od.totalModelledOutflow }
      }
      return breakdown
    }
    case 'car': {
      const unfinancedRegistration = result.scenario.financeRegistrationFees ? 0 : result.scenario.registrationFees
      const financedCharges = roundMoney(
        result.scenario.financedInsurance
          + (result.scenario.financeRegistrationFees ? result.scenario.registrationFees : 0),
      )
      const onRoad = section({
        oneTimeCost: roundMoney(result.scenario.processingFee + unfinancedRegistration),
        totalCost: roundMoney(result.scenario.processingFee + unfinancedRegistration),
      })
      const balloon = section({
        oneTimeCashFlow: result.native.balloonAmount,
        totalCashFlow: result.native.balloonAmount,
        proceeds: result.scenario.expectedResaleValue,
      })
      const repayment = prepaymentSummary(result.scenario.prepayments, result.view.schedule)
      const scheduled = scheduleRepayment(result.view.schedule)
      const totalLoanPayable = roundMoney(scheduled + result.scenario.processingFee)
      const totalOverallCost = roundMoney(
        totalLoanPayable + result.native.downPaymentAmount + unfinancedRegistration,
      )
      return {
        composition: [
          { label: 'Base vehicle amount financed', value: roundMoney(result.scenario.vehiclePrice - result.native.downPaymentAmount) },
          ...(financedCharges ? [{ label: 'Financed one-time charges', value: financedCharges }] : []),
          { label: 'Total financed principal', value: result.native.financedPrincipal },
        ],
        sections: { onRoad, balloon, repayment },
        overall: finalize({
          emi: result.native.initialEmi,
          recurringCost: 0,
          plannedMonthlyCashFlow: repayment.monthlyCashFlow,
          loanAmount: result.native.financedPrincipal,
          interest: result.native.totalInterest,
          otherCharges: onRoad.totalCost,
          totalLoanPayable,
          upfrontContribution: result.native.downPaymentAmount,
          totalOverallCost,
          proceeds: result.scenario.expectedResaleValue,
          tenureMonths: result.scenario.tenureMonths,
        }),
      }
    }
    case 'personal': {
      const deductions = section({
        oneTimeCost: result.native.totalDeductions,
        totalCost: result.native.totalDeductions,
      })
      const repayment = prepaymentSummary(result.scenario.prepayments, result.view.schedule)
      return {
        composition: [
          { label: 'Net amount received', value: result.native.netDisbursed },
          ...(result.native.totalDeductions
            ? [{ label: 'Upfront deductions within principal', value: result.native.totalDeductions }]
            : []),
          { label: 'Total requested principal', value: result.scenario.principal },
        ],
        sections: { deductions, repayment },
        overall: finalize({
          emi: result.native.initialEmi,
          recurringCost: 0,
          plannedMonthlyCashFlow: repayment.monthlyCashFlow,
          loanAmount: result.scenario.principal,
          interest: result.native.totalInterest,
          otherCharges: result.native.totalDeductions,
          totalLoanPayable: result.native.totalRepayment,
          upfrontContribution: 0,
          totalOverallCost: result.native.totalRepayment,
          proceeds: 0,
          tenureMonths: result.scenario.tenureMonths,
        }),
      }
    }
    case 'education': {
      const funding = section({
        oneTimeCashFlow: result.scenario.ownContribution,
        totalCashFlow: result.scenario.ownContribution,
      })
      const phaseMonths = result.scenario.studyMonths + result.scenario.moratoriumMonths
      const servicingMonthly = result.scenario.servicingMode === 'fixed-monthly'
        ? result.scenario.servicingAmount
        : phaseMonths ? roundMoney(result.native.servicedInterest / phaseMonths) : 0
      const moratorium = section({
        monthlyCost: servicingMonthly,
        totalCost: result.native.servicedInterest,
      })
      const extras = prepaymentSummary(result.scenario.prepayments, result.view.schedule)
      const repayment = section({
        oneTimeCost: result.scenario.processingFee,
        totalCost: result.scenario.processingFee,
        monthlyCashFlow: roundMoney(result.native.initialEmi + extras.monthlyCashFlow),
        oneTimeCashFlow: extras.oneTimeCashFlow,
        totalCashFlow: roundMoney(scheduleRepayment(result.view.schedule)),
      })
      const interest = roundMoney(
        result.native.servicedInterest + result.native.capitalizedInterest + result.native.repaymentInterest,
      )
      return {
        composition: [
          { label: 'Original principal disbursed', value: result.native.totalDisbursed },
          ...(result.native.capitalizedInterest
            ? [{ label: 'Capitalized interest', value: result.native.capitalizedInterest }]
            : []),
          { label: 'Repayment-start principal', value: result.native.repaymentPrincipal },
        ],
        sections: { funding, moratorium, repayment },
        overall: finalize({
          emi: result.native.initialEmi,
          recurringCost: 0,
          plannedMonthlyCashFlow: extras.monthlyCashFlow,
          loanAmount: result.native.totalDisbursed,
          interest,
          otherCharges: result.scenario.processingFee,
          totalLoanPayable: result.native.totalCost,
          upfrontContribution: result.scenario.ownContribution,
          totalOverallCost: roundMoney(result.native.totalCost + result.scenario.ownContribution),
          proceeds: 0,
          tenureMonths: phaseMonths + result.scenario.repaymentTenureMonths,
        }),
      }
    }
  }
}
