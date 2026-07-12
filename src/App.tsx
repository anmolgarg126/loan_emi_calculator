import { lazy, Suspense, useEffect, useReducer, useState } from 'react'
import { CalculatorShell } from './components/CalculatorShell'
import { CarForm } from './components/calculators/CarForm'
import { EducationForm } from './components/calculators/EducationForm'
import { GenericForm } from './components/calculators/GenericForm'
import { HomeForm } from './components/calculators/HomeForm'
import { PersonalForm } from './components/calculators/PersonalForm'
import type { CalculatorKind, SolverKind, SuiteScenario, UnifiedViewResult } from './domain/calculators'
import { formatCurrency } from './domain/loan'
import { copyScenarioUrl } from './lib/share'
import { createInitialSuiteModel, reduceSuiteModel } from './lib/suite-state'

const SolverForm = lazy(() => import('./components/calculators/SolverForm').then((module) => ({ default: module.SolverForm })))

const formatMetric = (metric: UnifiedViewResult['metrics'][number]) => {
  if (metric.format === 'currency') return formatCurrency(Number(metric.value))
  if (metric.format === 'percentage') return `${Number(metric.value).toFixed(2)}%`
  if (metric.format === 'date') return new Date(`${metric.value}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return String(metric.value)
}

function App() {
  const [model, dispatch] = useReducer(reduceSuiteModel, undefined, () => createInitialSuiteModel())
  const [solver, setSolver] = useState<SolverKind | null>(null)
  const [status, setStatus] = useState(() => window.location.hash && !model.shared ? 'The shared scenario link was invalid and has been ignored.' : '')
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

  const form = (() => {
    switch (model.scenario.kind) {
      case 'generic': return <GenericForm scenario={model.scenario.value} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'generic', value })} />
      case 'home': return <HomeForm scenario={model.scenario.value} result={current.kind === 'home' ? current.native : displayed.native as never} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'home', value })} />
      case 'car': return <CarForm scenario={model.scenario.value} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'car', value })} />
      case 'personal': return <PersonalForm scenario={model.scenario.value} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'personal', value })} />
      case 'education': return <EducationForm scenario={model.scenario.value} issueFor={issueFor} onChange={(value) => setScenario({ kind: 'education', value })} />
    }
  })()

  const resultPanel = <div className="results-sticky">
    <div className="result-heading"><div><span>{current.kind === 'home' ? 'Home loan result' : `${current.kind[0]?.toUpperCase()}${current.kind.slice(1)} loan result`}</span><h2>Your repayment view</h2></div><button type="button" className="text-button" onClick={() => dispatch({ type: 'reset', now: Date.now() })}>Reset calculator</button></div>
    {current.view.errors.length > 0 && <div className="validation-summary" role="alert"><strong>Check the highlighted inputs.</strong><p>The figures below remain the last valid estimate.</p><ul>{current.view.errors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}</ul></div>}
    <div className="primary-result"><span>{displayed.view.primary.label}</span><strong>{formatMetric(displayed.view.primary)}</strong><small>{displayed.kind === 'home' ? 'Standard loan before optional OD comparison' : 'Based on the current scenario'}</small></div>
    <dl className="metric-list">{displayed.view.metrics.map((metric) => <div key={metric.id}><dt>{metric.label}</dt><dd>{formatMetric(metric)}</dd></div>)}</dl>
    <div className="result-actions">
      <button type="button" className="primary-button" onClick={share} disabled={current.view.errors.length > 0}>Share scenario</button>
      {model.undo && <button type="button" className="secondary-button" onClick={() => dispatch({ type: 'undo-reset', now: Date.now() })}>Undo reset</button>}
    </div>
    {status && <p className="status-message" aria-live="polite">{status}</p>}
  </div>

  const schedule = <section className="suite-schedule" aria-labelledby="schedule-title">
    <div className="section-heading"><div><h2 id="schedule-title">Payment schedule</h2><p>Accessible monthly detail behind every summary figure.</p></div><span>{displayed.view.schedule.length} payments</span></div>
    <div className="table-scroll"><table><thead><tr><th>Payment date</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Prepayment</th><th>Costs</th><th>Balance</th></tr></thead><tbody>{displayed.view.schedule.slice(0, 24).map((row) => <tr key={`${row.date}-${row.period}`}><td>{row.date}</td><td>{formatCurrency(row.payment)}</td><td>{formatCurrency(row.principal)}</td><td>{formatCurrency(row.interest)}</td><td>{formatCurrency(row.prepayment)}</td><td>{formatCurrency(row.costs)}</td><td>{formatCurrency(row.balance)}</td></tr>)}</tbody></table></div>
    {displayed.view.schedule.length > 24 && <p className="table-note">Showing the first 24 payments. Year-by-year expansion and exports appear with the interactive graph.</p>}
  </section>

  return <>
    {solver && <Suspense fallback={<div className="solver-loading" role="status">Opening solver…</div>}><SolverForm kind={solver} onClose={() => setSolver(null)} /></Suspense>}
    <CalculatorShell activeKind={model.scenario.kind} onSelectKind={selectKind} onSelectSolver={setSolver} form={form} results={resultPanel} graph={<section className="graph-stage" aria-labelledby="graph-title"><div><h2 id="graph-title">Payment trajectory</h2><p>The interactive principal, interest, costs, prepayment, balance, and OD comparison graph is the next layer of this view.</p></div></section>} schedule={schedule} />
  </>
}

export default App
