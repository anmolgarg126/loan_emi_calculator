import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSuiteScenario } from '../domain/calculators'
import {
  deleteRememberedScenario,
  parseRememberedSnapshot,
  readRememberedScenario,
  REMEMBERED_KEY,
  saveRememberedScenario,
} from './remembered-scenario'

afterEach(() => vi.unstubAllGlobals())

describe('remembered scenario', () => {
  it('saves, explicitly reads, and deletes one local snapshot', () => {
    const entries = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      setItem: (key: string, value: string) => entries.set(key, value),
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string) => entries.delete(key),
    })
    const scenario = defaultSuiteScenario('car')

    expect(saveRememberedScenario(scenario)).toBe(true)
    expect(entries.has(REMEMBERED_KEY)).toBe(true)
    expect(readRememberedScenario()).toEqual(scenario)
    expect(deleteRememberedScenario()).toBe(true)
    expect(readRememberedScenario()).toBeNull()
  })

  it('rejects malformed remembered data atomically', () => {
    expect(parseRememberedSnapshot('{"version":2,"scenario":{"kind":"education","value":{"disbursements":[null]}}}')).toBeNull()
  })

  it('contains storage exceptions and never auto-restores', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => { throw new Error('blocked') },
      getItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })

    expect(saveRememberedScenario(defaultSuiteScenario('home'))).toBe(false)
    expect(readRememberedScenario()).toBeNull()
    expect(deleteRememberedScenario()).toBe(false)
  })

  it('does not store a runtime-invalid scenario', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { setItem })
    const scenario = defaultSuiteScenario('generic')

    expect(saveRememberedScenario({
      ...scenario,
      value: { ...scenario.value, principal: Number.NaN },
    })).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
  })
})
