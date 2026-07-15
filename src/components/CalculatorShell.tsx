import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { CalculatorKind, SolverKind } from '../domain/calculators'
import { applyTheme, readTheme } from '../lib/theme'

const calculators: Array<{ kind: CalculatorKind; label: string }> = [
  { kind: 'generic', label: 'Generic' },
  { kind: 'home', label: 'Home' },
  { kind: 'car', label: 'Car' },
  { kind: 'personal', label: 'Personal' },
  { kind: 'education', label: 'Education' },
]
const solvers: Array<{ kind: SolverKind; label: string }> = [
  { kind: 'affordability', label: 'Affordability' },
  { kind: 'prepayment', label: 'Prepayment' },
  { kind: 'tenure', label: 'Tenure' },
  { kind: 'interest-rate', label: 'Interest rate' },
]

const calculatorTitles: Record<CalculatorKind, string> = {
  generic: 'Loan EMI Calculator',
  home: 'Home Loan EMI Calculator',
  car: 'Car Loan EMI Calculator',
  personal: 'Personal Loan EMI Calculator',
  education: 'Education Loan EMI Calculator',
}

export function CalculatorShell({ activeKind, onSelectKind, onSelectSolver, form, results, graph, schedule }: {
  activeKind: CalculatorKind
  onSelectKind: (kind: CalculatorKind) => void
  onSelectSolver: (kind: SolverKind) => void
  form: ReactNode
  results: ReactNode
  graph: ReactNode
  schedule: ReactNode
}) {
  const [theme, setTheme] = useState(readTheme)
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    setTheme(next)
  }
  const keyNavigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + direction + calculators.length) % calculators.length
    const target = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]
    target?.focus()
  }
  return (
    <>
      <a className="skip-link" href="#calculator-workspace">Skip to calculator</a>
      <header className="app-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Loan EMI Calculator home">
          <span className="brand-mark" aria-hidden="true">L</span>
          <strong>Loan EMI Calculator</strong>
        </a>
        <button type="button" className="theme-toggle" aria-pressed={theme === 'dark'} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={toggleTheme}>
          <span aria-hidden="true">{theme === 'light' ? '\u263e\ufe0e' : '\u2600\ufe0e'}</span>
        </button>
      </header>
      <main>
        <nav className="calculator-nav" aria-label="Loan calculators">
          <div className="calculator-bar">
            <div className="tabs" role="tablist" aria-label="Choose a loan calculator">
              {calculators.map(({ kind, label }, index) => (
                <button key={kind} type="button" role="tab" aria-selected={activeKind === kind} tabIndex={activeKind === kind ? 0 : -1} onKeyDown={(event) => keyNavigate(event, index)} onClick={() => onSelectKind(kind)}>{label}</button>
              ))}
            </div>
            <details className="tools-menu">
              <summary>Tools</summary>
              <div className="solver-tools" aria-label="Loan solver tools">
                {solvers.map(({ kind, label }) => <button key={kind} type="button" onClick={() => onSelectSolver(kind)}>{label}</button>)}
              </div>
            </details>
          </div>
          <p className="privacy-note">All calculations stay on this device.</p>
        </nav>
        <div className="workspace" id="calculator-workspace">
          <section className="form-panel" aria-labelledby="scenario-title">
            <div className="panel-title"><h1 id="scenario-title">{calculatorTitles[activeKind]}</h1></div>
            {form}
          </section>
          <aside className="results-panel" aria-label="Calculation results">{results}</aside>
        </div>
        {graph}
        {schedule}
      </main>
    </>
  )
}
