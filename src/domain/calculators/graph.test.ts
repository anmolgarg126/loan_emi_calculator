import { describe, expect, it } from 'vitest'
import { roundMoney } from '../loan'
import { calculateSuite, defaultSuiteScenario } from './index'
import { aggregateGraphPeriods } from './graph'

describe('graph aggregation', () => {
  it('aggregates yearly bars without changing flow totals', () => {
    const result = calculateSuite(defaultSuiteScenario('home'))
    const yearly = aggregateGraphPeriods(result.view.schedule, 'yearly')

    for (const key of ['principal', 'prepayment', 'interest', 'costs', 'payment'] as const) {
      expect(roundMoney(yearly.reduce((sum, row) => sum + row[key], 0))).toBe(
        roundMoney(result.view.schedule.reduce((sum, row) => sum + row[key], 0)),
      )
    }
    expect(yearly.at(-1)?.balance).toBe(result.view.schedule.at(-1)?.balance)
    expect(yearly.at(-1)?.odNetUtilized).toBe(result.view.schedule.at(-1)?.odNetUtilized)
  })

  it('preserves one graph period per monthly schedule row', () => {
    const result = calculateSuite(defaultSuiteScenario('car'))
    const monthly = aggregateGraphPeriods(result.view.schedule, 'monthly')

    expect(monthly).toHaveLength(result.view.schedule.length)
    expect(monthly[0]).toMatchObject({
      key: result.view.schedule[0]?.date.slice(0, 7),
      principal: result.view.schedule[0]?.principal,
      balance: result.view.schedule[0]?.balance,
    })
  })

  it('returns an empty graph for an empty invalid schedule', () => {
    expect(aggregateGraphPeriods([], 'yearly')).toEqual([])
  })
})
