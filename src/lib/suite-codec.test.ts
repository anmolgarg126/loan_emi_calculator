import { describe, expect, it } from 'vitest'
import { defaultSuiteScenario } from '../domain/calculators'
import { parseSuiteScenario, parseSuiteScenarioJson, serializeSuiteScenario } from './suite-codec'

describe('suite scenario codec', () => {
  it.each(['generic', 'home', 'car', 'personal', 'education'] as const)(
    'round-trips a declared %s scenario',
    (kind) => {
      const scenario = defaultSuiteScenario(kind)
      expect(parseSuiteScenarioJson(serializeSuiteScenario(scenario))).toEqual(scenario)
    },
  )

  it('strips unknown keys while preserving declared nested fields', () => {
    const scenario = defaultSuiteScenario('education')
    const decoded = parseSuiteScenario({
      ...scenario,
      unknown: true,
      value: {
        ...scenario.value,
        unknown: true,
        disbursements: scenario.value.disbursements.map((item) => ({ ...item, unknown: true })),
      },
    })

    expect(decoded).toEqual(scenario)
    expect(decoded).not.toHaveProperty('unknown')
    expect(decoded.value).not.toHaveProperty('unknown')
  })

  it.each([
    null,
    [],
    { kind: 'mortgage', value: {} },
    { kind: 'education', value: { disbursements: [null] } },
    { kind: 'generic', value: { principal: Number.NaN } },
  ])('rejects malformed input atomically %#', (value) => {
    expect(() => parseSuiteScenario(value)).toThrow()
  })

  it('rejects duplicate IDs and capped lists over 100 entries', () => {
    const generic = defaultSuiteScenario('generic')
    const duplicate = {
      ...generic,
      value: {
        ...generic.value,
        prepayments: [
          { id: 'same', date: generic.value.startDate, amount: 1, frequency: 'once' },
          { id: 'same', date: generic.value.startDate, amount: 1, frequency: 'once' },
        ],
      },
    }
    const education = defaultSuiteScenario('education')
    const oversized = {
      ...education,
      value: {
        ...education.value,
        disbursements: Array.from({ length: 101 }, (_, index) => ({
          id: String(index), date: education.value.startDate, amount: 1,
        })),
      },
    }

    expect(() => parseSuiteScenario(duplicate)).toThrow()
    expect(() => parseSuiteScenario(oversized)).toThrow()
  })

  it('returns null for malformed JSON', () => {
    expect(parseSuiteScenarioJson('{bad')).toBeNull()
  })

  it('refuses to serialize runtime-invalid scenarios', () => {
    const scenario = defaultSuiteScenario('generic')
    expect(() => serializeSuiteScenario({
      ...scenario,
      value: { ...scenario.value, principal: Number.NaN },
    })).toThrow()
  })
})
