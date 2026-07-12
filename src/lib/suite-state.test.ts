import { describe, expect, it } from 'vitest'
import { defaultCarScenario, defaultSuiteScenario } from '../domain/calculators'
import { createInitialSuiteModel, createSuiteModel, reduceSuiteModel } from './suite-state'

describe('suite state', () => {
  it('starts with the complete graph range visible', () => {
    expect(createSuiteModel(defaultSuiteScenario('generic')).graph.rangeEnd).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('resets the active calculator and keeps an undo snapshot for ten seconds', () => {
    const current = createSuiteModel({
      kind: 'car',
      value: { ...defaultCarScenario(), vehiclePrice: 2_000_000 },
    })
    const reset = reduceSuiteModel(current, { type: 'reset', now: 1_000 })

    expect(reset.scenario).toEqual(defaultSuiteScenario('car'))
    expect(reset.undo?.scenario).toEqual(current.scenario)
    expect(reset.undo?.expiresAt).toBe(11_000)
    expect(reduceSuiteModel(reset, { type: 'undo-reset', now: 10_999 }).scenario).toEqual(current.scenario)
    expect(reduceSuiteModel(reset, { type: 'undo-reset', now: 11_000 })).toBe(reset)
  })

  it('keeps two models independent', () => {
    const first = createSuiteModel(defaultSuiteScenario('generic'))
    const second = createSuiteModel(defaultSuiteScenario('home'))
    const changed = reduceSuiteModel(first, { type: 'select-kind', kind: 'education' })

    expect(second.scenario.kind).toBe('home')
    expect(changed.scenario.kind).toBe('education')
    expect(first.scenario.kind).toBe('generic')
  })

  it('retains the last valid result when an edit is invalid', () => {
    const scenario = defaultSuiteScenario('generic')
    const current = createSuiteModel(scenario)
    const invalid = {
      ...scenario,
      value: { ...scenario.value, principal: 0 },
    }
    const changed = reduceSuiteModel(current, { type: 'set-scenario', scenario: invalid })

    expect(changed.currentResult.view.errors.length).toBeGreaterThan(0)
    expect(changed.lastValidResult).toBe(current.currentResult)
  })

  it('updates graph state without recalculating', () => {
    const current = createSuiteModel(defaultSuiteScenario('home'))
    const changed = reduceSuiteModel(current, {
      type: 'set-graph',
      graph: { granularity: 'monthly', selectedPeriod: '2027-01' },
    })

    expect(changed.graph).toMatchObject({ granularity: 'monthly', selectedPeriod: '2027-01' })
    expect(changed.currentResult).toBe(current.currentResult)
  })

  it('lets a valid shared scenario win over the calculator query', () => {
    const shared = defaultSuiteScenario('personal')
    const model = createInitialSuiteModel('https://example.test/app/?calculator=car#v2=deferred', shared)

    expect(model.scenario).toEqual(shared)
    expect(model.shared).toBe(true)
  })

  it.each([
    ['https://example.test/app/?calculator=education', 'education'],
    ['https://example.test/app/?calculator=unknown', 'generic'],
    ['https://example.test/app/#v2=bad', 'generic'],
  ] as const)('selects the safe startup calculator for %s', (url, kind) => {
    expect(createInitialSuiteModel(url).scenario.kind).toBe(kind)
  })

  it('expires reset undo without changing calculations', () => {
    const reset = reduceSuiteModel(createSuiteModel(defaultSuiteScenario('car')), { type: 'reset', now: 1 })
    const expired = reduceSuiteModel(reset, { type: 'expire-undo', now: 10_001 })

    expect(expired.undo).toBeNull()
    expect(expired.currentResult).toBe(reset.currentResult)
  })
})
