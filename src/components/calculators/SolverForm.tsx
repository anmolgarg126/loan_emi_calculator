import { useMemo, useState } from 'react'
import { comparePrepayment, defaultGenericScenario, solveAffordablePrincipal, solveAnnualRate, solveTenureMonths, type SolverKind } from '../../domain/calculators'
import { formatCurrency } from '../../domain/loan'
import { DateField, NumberField, SelectField } from '../CalculatorFields'

export function SolverForm({ kind, onClose }: { kind: SolverKind; onClose: () => void }) {
  const [principal, setPrincipal] = useState(1_000_000)
  const [rate, setRate] = useState(10)
  const [months, setMonths] = useState(60)
  const [emi, setEmi] = useState(25_000)
  const [extra, setExtra] = useState(10_000)
  const [date, setDate] = useState(defaultGenericScenario().startDate)
  const [mode, setMode] = useState<'keep-emi' | 'keep-tenure'>('keep-emi')
  const solved = useMemo(() => {
    try {
      if (kind === 'affordability') return { value: formatCurrency(solveAffordablePrincipal({ emi, annualRate: rate, tenureMonths: months })), label: 'Estimated affordable principal' }
      if (kind === 'tenure') return { value: `${solveTenureMonths({ principal, annualRate: rate, emi })} months`, label: 'Estimated repayment tenure' }
      if (kind === 'interest-rate') return { value: `${solveAnnualRate({ principal, emi, tenureMonths: months }).toFixed(3)}%`, label: 'Implied annual reducing rate' }
      const scenario = { ...defaultGenericScenario(), principal, annualRate: rate, tenureMonths: months, startDate: date }
      const comparison = comparePrepayment({ scenario, prepayments: [{ id: 'solver', date, amount: extra, frequency: 'monthly' }], mode })
      return { value: formatCurrency(comparison.interestSaved), label: mode === 'keep-emi' ? `Interest saved · ${comparison.monthsSaved} months sooner` : 'Interest saved · tenure unchanged' }
    } catch (error) {
      return { value: 'Adjust the inputs', label: error instanceof Error ? error.message : 'This combination cannot be solved.' , error: true }
    }
  }, [date, emi, extra, kind, mode, months, principal, rate])
  return <section className="solver-panel" role="dialog" aria-modal="true" aria-labelledby="solver-title">
    <div className="solver-heading"><div><span>Quick tool</span><h2 id="solver-title">{kind === 'interest-rate' ? 'Interest rate' : kind[0]?.toUpperCase() + kind.slice(1)} solver</h2></div><button type="button" className="icon-button" aria-label="Close solver" autoFocus onClick={onClose}>×</button></div>
    <div className="field-grid">
      {kind !== 'affordability' && <NumberField id="solver-principal" label="Principal" value={principal} onChange={setPrincipal} prefix="₹" />}
      {kind !== 'interest-rate' && <NumberField id="solver-rate" label="Annual rate" value={rate} onChange={setRate} suffix="%" max={50} />}
      {kind !== 'tenure' && <NumberField id="solver-months" label="Tenure" value={months} onChange={(value) => setMonths(Math.round(value))} suffix="months" max={480} step={1} />}
      {kind !== 'prepayment' && <NumberField id="solver-emi" label="Monthly EMI" value={emi} onChange={setEmi} prefix="₹" />}
      {kind === 'prepayment' && <><NumberField id="solver-extra" label="Monthly prepayment" value={extra} onChange={setExtra} prefix="₹" /><DateField id="solver-date" label="First EMI date" value={date} onChange={setDate} /><SelectField id="solver-mode" label="After prepayment" value={mode} onChange={(value) => setMode(value as typeof mode)}><option value="keep-emi">Keep EMI, shorten tenure</option><option value="keep-tenure">Keep tenure, reduce EMI</option></SelectField></>}
    </div>
    <div className={solved.error ? 'solver-answer error' : 'solver-answer'} aria-live="polite"><span>{solved.label}</span><strong>{solved.value}</strong></div>
  </section>
}
