import { lazy, Suspense, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { CalculatorShell } from './components/CalculatorShell'
import { ResultSummary } from './components/ResultSummary'
import { CarForm } from './components/calculators/CarForm'
import { EducationForm } from './components/calculators/EducationForm'
import { GenericForm } from './components/calculators/GenericForm'
import { HomeForm } from './components/calculators/HomeForm'
import { PersonalForm } from './components/calculators/PersonalForm'
import type { CalculatorKind, SolverKind, SuiteScenario } from './domain/calculators'
import { createInitialSuiteModel, reduceSuiteModel } from './lib/suite-state'
import { deleteRememberedScenario, readRememberedScenario, saveRememberedScenario } from './lib/remembered-scenario'
import { copyScenarioUrl, decodeSharedScenario } from './lib/share'

const SolverForm = lazy(() => import('./components/calculators/SolverForm').then((module) => ({ default: module.SolverForm })))
const AnalysisDetails = lazy(() => import('./components/AnalysisDetails'))

function DeferredAnalysis({ force, children }: { force: boolean; children: ReactNode }) {
  const [visible, setVisible] = useState(force)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (force) return
    if (typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(() => setVisible(true), 0)
      return () => window.clearTimeout(timer)
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [force])
  return <div ref={ref}>{visible || force ? children : <section className="analysis-placeholder"><h2>Payment trajectory</h2><p>Interactive graph and schedule load as you reach this section.</p></section>}</div>
}

function App() {
  const [initialShared] = useState(() => window.location.hash ? decodeSharedScenario(window.location.hash) : null)
  const [model, dispatch] = useReducer(reduceSuiteModel, undefined, () => createInitialSuiteModel(window.location.href, initialShared ?? undefined))
  const [solver, setSolver] = useState<SolverKind | null>(null)
  const [status, setStatus] = useState(() => initialShared ? 'Loaded from a shared link.' : window.location.hash ? 'The shared scenario link was invalid and has been ignored.' : '')
  const [hasRemembered, setHasRemembered] = useState(() => Boolean(readRememberedScenario()))
  const [exporting, setExporting] = useState(false)
  const [analysisRequested, setAnalysisRequested] = useState(false)
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
    if (!window.confirm('Delete the saved scenario from this device?')) return
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
  const reset = () => {
    dispatch({ type: 'reset', now: Date.now() })
    setStatus('Calculator reset. Undo available for 10 seconds.')
  }
  const undoReset = () => {
    dispatch({ type: 'undo-reset', now: Date.now() })
    setStatus('Reset undone.')
  }
  const print = async () => {
    await import('./components/AnalysisDetails')
    setAnalysisRequested(true)
    window.setTimeout(() => window.print(), 0)
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

  const resultPanel = <ResultSummary current={current} displayed={displayed} shared={model.shared} hasUndo={Boolean(model.undo)} hasRemembered={hasRemembered} exporting={exporting} status={status} onReset={reset} onUndo={undoReset} onRemember={remember} onRestore={restore} onDeleteRemembered={removeRemembered} onShare={share} onPrint={print} onCsv={exportCsv} onXlsx={exportXlsx} />

  const selectPeriod = (period: string | null) => dispatch({ type: 'set-graph', graph: { selectedPeriod: period } })
  const analysis = <DeferredAnalysis force={analysisRequested}><Suspense fallback={<section className="analysis-placeholder"><h2>Payment trajectory</h2><p>Preparing graph and schedule…</p></section>}><AnalysisDetails result={displayed} graph={model.graph} onGraphChange={(graph) => dispatch({ type: 'set-graph', graph })} onSelectPeriod={selectPeriod} /></Suspense></DeferredAnalysis>

  return <>
    {solver && <Suspense fallback={<div className="solver-loading" role="status">Opening solver…</div>}><SolverForm kind={solver} onClose={() => setSolver(null)} /></Suspense>}
    <CalculatorShell activeKind={model.scenario.kind} onSelectKind={selectKind} onSelectSolver={setSolver} form={form} results={resultPanel} graph={analysis} schedule={null} />
  </>
}

export default App
