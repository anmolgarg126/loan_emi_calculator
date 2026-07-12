import { describe, expect, it } from 'vitest'
import { buildAmortizationSchedule, calculateBalloonEmi } from './index'

const balloonInput = (patch: Partial<Parameters<typeof buildAmortizationSchedule>[0]> = {}) => ({
  principal: 100_000,
  annualRate: 12,
  tenureMonths: 12,
  startDate: '2026-01-01',
  prepayments: [],
  rateChanges: [],
  balloonAmount: 20_000,
  ...patch,
})

const balloonComponent = (result: ReturnType<typeof buildAmortizationSchedule>) => {
  const finalRow = result.rows.at(-1)!
  const priorBalance = result.rows.at(-2)?.balance ?? 100_000
  return finalRow.principal - Math.max(0, priorBalance - 20_000)
}

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

    const result = buildAmortizationSchedule(balloonInput({ annualRate: 0 }))
    expect(result.rows).toHaveLength(12)
    expect(balloonComponent(result)).toBeCloseTo(20_000, 2)
    expect(result.rows.at(-1)?.balance).toBe(0)
  })

  it.each([Number.NaN, -1, 100_000, 100_001])('rejects invalid balloon amount %s', (balloonAmount) => {
    const result = buildAmortizationSchedule(balloonInput({ balloonAmount }))

    expect(result.errors).not.toEqual([])
    expect(result.rows).toEqual([])
    expect([result.initialEmi, result.totalInterest, result.totalPrepayments].every(Number.isFinite)).toBe(true)
  })

  it('posts the balloon on the final contractual row and closes rounding residue', () => {
    const result = buildAmortizationSchedule(balloonInput())

    expect(result.initialEmi).toBe(7_307.9)
    expect(result.rows).toHaveLength(12)
    expect(result.rows.at(-1)?.emi).toBeGreaterThan(result.initialEmi)
    expect(balloonComponent(result)).toBeCloseTo(20_000, 2)
    expect(result.rows.at(-1)?.balance).toBe(0)
    expect(result.rows.reduce((sum, row) => sum + row.principal + row.prepayment, 0)).toBe(100_000)
  })

  it.each([
    { initialRate: 12, changedRate: 24, comparison: 'longer' },
    { initialRate: 24, changedRate: 1, comparison: 'shorter' },
  ])('keeps EMI and balloon while making the tenure $comparison after a reset', ({ initialRate, changedRate, comparison }) => {
    const result = buildAmortizationSchedule(balloonInput({
      annualRate: initialRate,
      rateChanges: [{
        id: comparison,
        date: '2026-04-01',
        annualRate: changedRate,
        mode: 'keep-emi',
      }],
    }))

    expect(result.errors).toEqual([])
    expect(comparison === 'longer' ? result.rows.length > 12 : result.rows.length < 12).toBe(true)
    expect(result.rows.slice(3, -1).every((row) => row.emi === result.initialEmi)).toBe(true)
    expect(balloonComponent(result)).toBeCloseTo(20_000, 2)
    expect(result.rows.at(-1)?.balance).toBe(0)
  })

  it('changes EMI but preserves tenure and balloon for a keep-tenure reset', () => {
    const result = buildAmortizationSchedule(balloonInput({
      rateChanges: [{
        id: 'keep-tenure',
        date: '2026-04-01',
        annualRate: 18,
        mode: 'keep-tenure',
      }],
    }))

    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(12)
    expect(result.rows[3]?.emi).not.toBe(result.initialEmi)
    expect(balloonComponent(result)).toBeCloseTo(20_000, 2)
    expect(result.rows.at(-1)?.balance).toBe(0)
  })

  it('caps a prepayment at the amortizing portion and pays the protected balloon next', () => {
    const result = buildAmortizationSchedule(balloonInput({
      prepayments: [{
        id: 'large-prepayment',
        date: '2026-02-01',
        amount: 100_000,
        frequency: 'once',
      }],
    }))

    expect(result.errors).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]?.balance).toBe(20_000)
    expect(result.rows[1]?.principal).toBe(20_000)
    expect(result.rows[1]?.emi).toBeGreaterThan(0)
    expect(result.rows[1]?.balance).toBe(0)
  })

  it('matches an independently calculated interest fixture', () => {
    const result = buildAmortizationSchedule(balloonInput({
      principal: 1_000,
      tenureMonths: 3,
      balloonAmount: 400,
    }))

    expect(result.initialEmi).toBe(208.01)
    expect(result.totalInterest).toBe(24.04)
  })
})
