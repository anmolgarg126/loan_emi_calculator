import { describe, expect, it } from 'vitest'
import { buildAmortizationSchedule, calculateBalloonEmi } from './index'

describe('amortization engine', () => {
  it('builds the standard EMI golden schedule', () => {
    const result = buildAmortizationSchedule({
      principal: 4_000_000,
      annualRate: 9,
      tenureMonths: 240,
      startDate: '2026-08-01',
      prepayments: [],
      rateChanges: [],
      balloonAmount: 0,
    })

    expect(result.initialEmi).toBe(35_989.04)
    expect(result.rows).toHaveLength(240)
    expect(result.rows.at(-1)?.balance).toBe(0)
    expect(result.rows.reduce((sum, row) => sum + row.interest, 0)).toBe(result.totalInterest)
  })

  it('calculates a zero-rate balloon EMI', () => {
    expect(calculateBalloonEmi(100_000, 0, 12, 20_000)).toBe(6_666.67)
  })

  it('rejects a balloon that is not below principal', () => {
    const result = buildAmortizationSchedule({
      principal: 100_000,
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2026-08-01',
      prepayments: [],
      rateChanges: [],
      balloonAmount: 100_000,
    })

    expect(result.errors).not.toEqual([])
    expect(result.rows).toEqual([])
  })

  it('posts the balloon on the final contractual row and closes rounding residue', () => {
    const result = buildAmortizationSchedule({
      principal: 100_000,
      annualRate: 12,
      tenureMonths: 12,
      startDate: '2026-08-01',
      prepayments: [],
      rateChanges: [],
      balloonAmount: 20_000,
    })

    expect(result.initialEmi).toBe(7_307.9)
    expect(result.rows).toHaveLength(12)
    expect(result.rows.at(-1)?.emi).toBeGreaterThan(result.initialEmi)
    expect(result.rows.at(-1)?.balance).toBe(0)
    expect(result.rows.reduce((sum, row) => sum + row.principal + row.prepayment, 0)).toBe(100_000)
  })
})
