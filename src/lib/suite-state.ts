import {
  calculateSuite,
  defaultSuiteScenario,
  type CalculatorKind,
  type SuiteResult,
  type SuiteScenario,
} from '../domain/calculators'

export interface GraphState {
  granularity: 'yearly' | 'monthly'
  hiddenSeries: string[]
  rangeStart: number
  rangeEnd: number
  compareOd: boolean
  selectedPeriod: string | null
}

export interface SuiteModel {
  scenario: SuiteScenario
  currentResult: SuiteResult
  lastValidResult: SuiteResult
  shared: boolean
  graph: GraphState
  undo: { scenario: SuiteScenario; graph: GraphState; expiresAt: number } | null
}

export type SuiteAction =
  | { type: 'set-scenario'; scenario: SuiteScenario }
  | { type: 'select-kind'; kind: CalculatorKind }
  | { type: 'restore'; scenario: SuiteScenario }
  | { type: 'load-shared'; scenario: SuiteScenario }
  | { type: 'reset'; now: number }
  | { type: 'undo-reset'; now: number }
  | { type: 'expire-undo'; now: number }
  | { type: 'set-graph'; graph: Partial<GraphState> }
  | { type: 'clear-shared' }

export const defaultGraphState = (): GraphState => ({
  granularity: 'yearly',
  hiddenSeries: [],
  rangeStart: 0,
  rangeEnd: Number.MAX_SAFE_INTEGER,
  compareOd: false,
  selectedPeriod: null,
})

export const createSuiteModel = (scenario: SuiteScenario, shared = false): SuiteModel => {
  const result = calculateSuite(scenario)
  return {
    scenario,
    currentResult: result,
    lastValidResult: result,
    shared,
    graph: defaultGraphState(),
    undo: null,
  }
}

const transition = (
  current: SuiteModel,
  scenario: SuiteScenario,
  graph: GraphState,
  shared = false,
  undo: SuiteModel['undo'] = null,
): SuiteModel => {
  const result = calculateSuite(scenario)
  return {
    scenario,
    currentResult: result,
    lastValidResult: result.view.errors.length === 0 ? result : current.lastValidResult,
    shared,
    graph,
    undo,
  }
}

export const reduceSuiteModel = (current: SuiteModel, action: SuiteAction): SuiteModel => {
  switch (action.type) {
    case 'set-scenario':
      return transition(current, action.scenario, current.graph)
    case 'select-kind':
      return transition(current, defaultSuiteScenario(action.kind), defaultGraphState())
    case 'restore':
      return transition(current, action.scenario, defaultGraphState())
    case 'load-shared':
      return transition(current, action.scenario, defaultGraphState(), true)
    case 'reset':
      return transition(
        current,
        defaultSuiteScenario(current.scenario.kind),
        defaultGraphState(),
        false,
        { scenario: current.scenario, graph: current.graph, expiresAt: action.now + 10_000 },
      )
    case 'undo-reset':
      return current.undo && action.now < current.undo.expiresAt
        ? transition(current, current.undo.scenario, current.undo.graph)
        : current
    case 'expire-undo':
      return current.undo && action.now >= current.undo.expiresAt ? { ...current, undo: null } : current
    case 'set-graph':
      return { ...current, graph: { ...current.graph, ...action.graph } }
    case 'clear-shared':
      return current.shared ? { ...current, shared: false } : current
  }
}

const calculatorKinds = new Set<CalculatorKind>(['generic', 'home', 'car', 'personal', 'education'])

export const createInitialSuiteModel = (href = window.location.href, shared?: SuiteScenario) => {
  const url = new URL(href)
  if (shared) return createSuiteModel(shared, true)
  const query = url.searchParams.get('calculator') as CalculatorKind | null
  return createSuiteModel(defaultSuiteScenario(query && calculatorKinds.has(query) ? query : 'generic'))
}
