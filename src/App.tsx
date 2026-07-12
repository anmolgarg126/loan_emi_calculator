import { lazy, Suspense, useEffect, useReducer, useState } from 'react'
import { CalculatorShell } from './components/CalculatorShell'
import { ResultSummary } from './components/ResultSummary'
import { PaymentGraph } from './components/PaymentGraph'
import { Schedule } from './components/Schedule'
import { CarForm } from './components/calculators/CarForm'
import { EducationForm } from './components/calculators/EducationForm'
import { GenericForm } from './components/calculators/GenericForm'
import { HomeForm } from './components/calculators/HomeForm'
import { PersonalForm } from './components/calculators/PersonalForm'
import type { CalculatorKind, SolverKind, SuiteScenario } from './domain/calculators'
import { copyScenarioUrl } from './lib/share'
import { createInitialSuiteModel, reduceSuiteModel } from './lib/suite-state'
import { deleteRememberedScenario, readRememberedScenario, saveRememberedScenario } from './lib/remembered-scenario'

const SolverForm = lazy(() => import('./components/calculators/SolverForm').then((module) => ({ default: module.SolverForm })))

function App() {
  const [model, dispatch] = useReducer(reduceSuiteModel, undefined, () => createInitialSuiteModel())
  const [solver, setSolver] = useState<SolverKind | null>(null)
  const [status, setStatus] = useState(() => model.shared ? 'Loaded from a shared link.' : window.location.hash ? 'The shared scenario link was invalid and has been ignored.' : '')
  const [hasRemembered, setHasRemembered] = useState(() => Boolean(readRememberedScenario()))
  const [exporting, setExporting] = useState(false)
  const current = model.currentResult
  const displayed = current.view.errors.length === 0 || model.lastValidResult.kind !== current.kind
    ? current : model.lastValidResult
  const issueFor = (field: string) => current.view.issues.find((issue) => issue.field === field)?.message

  useEffect(() => {
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.head.appendChild(document.createElement('link'))
    canonical.rel = 'canonical'
    canonical.href = import.meta.env.VITE_SITE_URL || new URL(import.meta.env.BASE_URL, window.location.origin).toString()
  }, [])

  useEffect(() => {
    if (!model.undo) return
    const delay = Math.max(0, model.undo.expiresAt - Date.now())
    const timer = window.setTimeout(() => dispatch({ type: 'expire-undo', now: Date.now() }), delay)
    return () => window.clearTimeout(timer)
  }, [model.undo])

  const selectKind = (kind: CalculatorKind) => {
    const url = new URL(window.location.href)
    url.searchParams.set('calculator', kind)
    url.hash = ''
    window.history.replaceState(null, '', url)
    dispatch({ type: 'select-kind', kind })
    setSolver(null)
    setStatus('')
  }
  const setScenario = (scenario: SuiteScenario) => dispatch({ type: 'set-scenario', scenario })
  const share = async () => {
    try {
      await copyScenarioUrl(model.scenario)
      setStatus('Share link copied. Your inputs are included only in that link.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to create a share link.')
    }
  }
  const remember = () => {
    const saved = saveRememberedScenario(model.scenario)
    setHasRemembered(saved || hasRemembered)
    setStatus(saved ? 'Scenario remembered on this device. It is restored only when you choose Restore saved.' : 'This browser blocked local storage. The scenario was not saved.')
  }
  const restore = () => {
    const scenario = readRememberedScenario()
    if (!scenario) {
      setHasRemembered(false)
      setStatus('No valid saved scenario was found.')
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set('calculator', scenario.kind)
    url.hash = ''
    window.history.replaceState(null, '', url)
    dispatch({ type: 'restore', scenario })
    setStatus('Saved scenario restored into this tab.')
  }
  const removeRemembered = () => {
    const deleted = deleteRememberedScenario()
    if (deleted) setHasRemembered(false)
    setStatus(deleted ? 'Saved scenario deleted. Your current calculator is unchanged.' : 'This browser could not delete the saved scenario.')
  }
  const exportCsv = async () => {
    const { downloadSuiteCsv } = await import('./lib/exports')
    downloadSuiteCsv(displayed)
    setStatus('CSV schedule downloaded.')
  }
  const exportXlsx = async () => {
    setExporting(true)
    setStatus('Preparing typed Excel workbook…')
    try {
      const { downloadSuiteXlsx } = await import('./lib/exports')
      await downloadSuiteXlsx(displayed)
      setStatus('Excel workbook downloaded.')
    } catch {
      setStatus('Excel export failed. Your calculation is unchanged.')
    } finally {
      setExporting(false)
    }
  }

  const form = (() => {
    switch (model.scenario.kind) {
      case 'generic': return <GenericForm scenario={model.scenario.value} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'generic', value })} />
      case 'home': return <HomeForm scenario={model.scenario.value} result={current.kind === 'home' ? current.native : displayed.native as never} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'home', value })} />
      case 'car': return <CarForm scenario={model.scenario.value} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'car', value })} />
      case 'personal': return <PersonalForm scenario={model.scenario.value} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'personal', value })} />
      case 'education': return <EducationForm scenario={model.scenario.value} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'education', value })} />
    }
  })()

  const resultPanel = <ResultSummary current={current} displayed={displayed} shared={model.shared} hasUndo={Boolean(model.undo)} hasRemembered={hasRemembered} exporting={exporting} status={status} onReset={() => dispatch({ type: 'reset', now: Date.now() })} onUndo={() => dispatch({ type: 'undo-reset', now: Date.now() })} onRemember={remember} onRestore={restore} onDeleteRemembered={removeRemembered} onShare={share} onPrint={() => window.print()} onCsv={exportCsv} onXlsx={exportXlsx} />

  const selectPeriod = (period: string | null) => dispatch({ type: 'set-graph', graph: { selectedPeriod: period } })
  const schedule = <Schedule schedule={displayed.view.schedule} selectedPeriod={model.graph.selectedPeriod} granularity={model.graph.granularity} onSelectPeriod={(period) => selectPeriod(period)} />

  return <>
    {solver && <Suspense fallback={<div className="solver-loading" role="status">Opening solver…</div>}><SolverForm kind={solver} onClose={() => setSolver(null)} /></Suspense>}
    <CalculatorShell activeKind={model.scenario.kind} onSelectKind={selectKind} onSelectSolver={setSolver} form={form} results={resultPanel} graph={<PaymentGraph result={displayed} graphState={model.graph} onGraphStateChange={(graph) => dispatch({ type: 'set-graph', graph })} onSelectPeriod={selectPeriod} />} schedule={schedule} />
  </>
}

export default App
