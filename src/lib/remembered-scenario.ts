import type { SuiteScenario } from '../domain/calculators'
import { parseSuiteScenario, SUITE_VERSION } from './suite-codec'

export const REMEMBERED_KEY = 'loan-ledger:remembered-scenario:v2'

export const parseRememberedSnapshot = (raw: string): SuiteScenario | null => {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    const snapshot = value as Record<string, unknown>
    return snapshot.version === SUITE_VERSION ? parseSuiteScenario(snapshot.scenario) : null
  } catch {
    return null
  }
}

export const saveRememberedScenario = (scenario: SuiteScenario) => {
  try {
    const validated = parseSuiteScenario(scenario)
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ version: SUITE_VERSION, scenario: validated }))
    return true
  } catch {
    return false
  }
}

export const readRememberedScenario = () => {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY)
    return raw ? parseRememberedSnapshot(raw) : null
  } catch {
    return null
  }
}

export const deleteRememberedScenario = () => {
  try {
    localStorage.removeItem(REMEMBERED_KEY)
    return true
  } catch {
    return false
  }
}
