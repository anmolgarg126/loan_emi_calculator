import { describe, expect, it } from 'vitest'
import { defaultScenario } from '../domain/loan'
import { decodeScenario, encodeScenario } from './share'

describe('scenario sharing', () => {
  it('round-trips a versioned scenario', () => {
    const scenario = defaultScenario()
    const fragment = encodeScenario(scenario)
    expect(decodeScenario(`#${fragment}`)).toEqual(scenario)
  })

  it('ignores malformed fragments', () => {
    expect(decodeScenario('#v1=not-json')).toBeNull()
  })

  it('rejects fragments over the safety limit', () => {
    expect(decodeScenario(`#v1=${'a'.repeat(8_001)}`)).toBeNull()
  })

  it('refuses to generate an oversized share fragment', () => {
    const scenario = defaultScenario()
    scenario.od.transactions = Array.from({ length: 100 }, (_, index) => ({
      id: `${index}-${'x'.repeat(100)}`,
      date: scenario.startDate,
      type: 'deposit' as const,
      amount: index,
    }))
    expect(() => encodeScenario(scenario)).toThrow('too large to share')
  })
})
