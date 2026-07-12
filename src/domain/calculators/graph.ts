import type { UnifiedScheduleRow } from './types'

export interface GraphPeriod {
  key: string
  label: string
  principal: number
  prepayment: number
  interest: number
  costs: number
  payment: number
  balance: number
  odNetUtilized?: number
}

export const aggregateGraphPeriods = (
  schedule: UnifiedScheduleRow[],
  granularity: 'monthly' | 'yearly',
): GraphPeriod[] => {
  if (granularity === 'monthly') return schedule.map((row) => ({
    key: row.date.slice(0, 7),
    label: new Date(`${row.date}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    principal: row.principal,
    prepayment: row.prepayment,
    interest: row.interest,
    costs: row.costs,
    payment: row.payment,
    balance: row.balance,
    odNetUtilized: row.odNetUtilized,
  }))
  const periods: GraphPeriod[] = []
  schedule.forEach((row) => {
    const key = row.date.slice(0, 4)
    let period = periods.at(-1)
    if (!period || period.key !== key) {
      period = { key, label: key, principal: 0, prepayment: 0, interest: 0, costs: 0, payment: 0, balance: 0 }
      periods.push(period)
    }
    period.principal += row.principal
    period.prepayment += row.prepayment
    period.interest += row.interest
    period.costs += row.costs
    period.payment += row.payment
    period.balance = row.balance
    period.odNetUtilized = row.odNetUtilized
  })
  return periods
}
