import type { SuiteResult, ViewMetric } from '../domain/calculators'
import type { CostBreakdown, SectionCostSummary } from '../domain/calculators/cost-breakdown'
import { formatCurrency } from '../domain/loan'

const formatMetric = (metric: ViewMetric) => {
  if (metric.format === 'currency') return formatCurrency(Number(metric.value))
  if (metric.format === 'percentage') return `${Number(metric.value).toFixed(2)}%`
  if (metric.format === 'date') return new Date(`${metric.value}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return String(metric.value)
}

const sectionLabels: Record<string, string> = {
  fees: 'Fees',
  repayment: 'Repayment changes',
  ownership: 'Ownership and lender costs',
  od: 'Overdraft facility',
  onRoad: 'On-road financing',
  balloon: 'Balloon and ownership horizon',
  deductions: 'Upfront deductions',
  funding: 'Study funding',
  moratorium: 'Moratorium servicing',
}

const hasSectionValue = (summary: SectionCostSummary) => Object.values(summary).some(Boolean)

const tenureLabel = (months: number) => months % 12 === 0
  ? `${months / 12} ${months === 12 ? 'year' : 'years'} (${months} months)`
  : `${months} months`

const redundantMetricIds: Record<SuiteResult['kind'], string[]> = {
  generic: ['total-interest', 'total-repayment'],
  home: ['loan-amount', 'total-interest'],
  car: ['financed-principal', 'total-interest', 'expected-resale'],
  personal: ['net-disbursed', 'total-deductions', 'total-interest', 'total-repayment'],
  education: ['total-disbursed', 'capitalized-interest', 'repayment-principal', 'total-cost'],
}

export function ResultSummary({ current, displayed, costs, shared, hasUndo, hasRemembered, exporting, status, onReset, onUndo, onRemember, onRestore, onDeleteRemembered, onShare, onPrint, onCsv, onXlsx }: {
  current: SuiteResult
  displayed: SuiteResult
  costs: CostBreakdown
  shared: boolean
  hasUndo: boolean
  hasRemembered: boolean
  exporting: boolean
  status: string
  onReset: () => void
  onUndo: () => void
  onRemember: () => void
  onRestore: () => void
  onDeleteRemembered: () => void
  onShare: () => void
  onPrint: () => void
  onCsv: () => void
  onXlsx: () => void
}) {
  const invalid = current.view.errors.length > 0
  const additionalMetrics = displayed.view.metrics.filter((metric) => !redundantMetricIds[displayed.kind].includes(metric.id))
  return <div className="results-sticky">
    <div className="result-heading">
      <h2>Loan summary</h2>
      <div className="result-heading-actions">
        {hasUndo && <button type="button" className="text-button" onClick={onUndo}>Undo reset</button>}
        <button type="button" className="text-button danger-button" onClick={onReset}>Reset calculator</button>
      </div>
    </div>
    {shared && <p className="shared-badge">Loaded from a shared link. Editing keeps this tab independent.</p>}
    {invalid && <div className="validation-summary" role="alert"><strong>Check the highlighted inputs.</strong><p>The figures below remain the last valid estimate.</p><ul>{current.view.errors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}</ul></div>}
    <div className="primary-result"><span>{displayed.view.primary.label}</span><strong>{formatMetric(displayed.view.primary)}</strong>{displayed.kind === 'home' && <small>Standard loan before optional OD comparison</small>}</div>
    <dl className="key-totals" aria-label="Loan totals">
      <div><dt>Loan amount</dt><dd>{formatCurrency(costs.overall.loanAmount)}</dd></div>
      <div><dt>Total interest</dt><dd>{formatCurrency(costs.overall.interest)}</dd></div>
      <div><dt>Other charges</dt><dd>{formatCurrency(costs.overall.otherCharges)}</dd></div>
      <div className="key-total"><dt>Total payable over selected tenure</dt><dd>{formatCurrency(costs.overall.totalOverallCost)}</dd></div>
    </dl>
    <details className="result-disclosure cost-details">
      <summary>Detailed cost breakdown</summary>
      <section className="cost-overview" aria-label="Detailed cost breakdown">
        <div className="cost-group">
          <h3>Monthly payment</h3>
          <dl className="cost-list">
            <div><dt>EMI</dt><dd>{formatCurrency(costs.overall.emi)}</dd></div>
            {costs.overall.recurringCost > 0 && <div><dt>Recurring non-loan cost</dt><dd>{formatCurrency(costs.overall.recurringCost)}</dd></div>}
            <div className="cost-total"><dt>Total ongoing monthly cost</dt><dd>{formatCurrency(costs.overall.totalMonthlyCost)}</dd></div>
            {costs.overall.plannedMonthlyCashFlow > 0 && <div><dt>Planned extra cash flow / month</dt><dd>{formatCurrency(costs.overall.plannedMonthlyCashFlow)}</dd></div>}
          </dl>
        </div>
        <div className="cost-group">
          <h3>Loan composition</h3>
          <dl className="cost-list">
            {costs.composition.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{formatCurrency(item.value)}</dd></div>)}
          </dl>
        </div>
        <div className="cost-group">
          <h3>Total payable</h3>
          <dl className="cost-list">
            <div><dt>Total loan amount</dt><dd>{formatCurrency(costs.overall.loanAmount)}</dd></div>
            <div><dt>Total interest</dt><dd>{formatCurrency(costs.overall.interest)}</dd></div>
            <div><dt>Total other charges</dt><dd>{formatCurrency(costs.overall.otherCharges)}</dd></div>
            <div><dt>Total loan payable</dt><dd>{formatCurrency(costs.overall.totalLoanPayable)}</dd></div>
            {costs.overall.upfrontContribution > 0 && <div><dt>Upfront contribution</dt><dd>{formatCurrency(costs.overall.upfrontContribution)}</dd></div>}
            <div className="cost-total"><dt>Total overall cost for {tenureLabel(costs.overall.tenureMonths)}</dt><dd>{formatCurrency(costs.overall.totalOverallCost)}</dd></div>
            {costs.overall.proceeds > 0 && <><div><dt>Expected proceeds</dt><dd>− {formatCurrency(costs.overall.proceeds)}</dd></div><div className="cost-total"><dt>Net overall cost</dt><dd>{formatCurrency(costs.overall.netOverallCost)}</dd></div></>}
            {costs.comparison && <div><dt>{costs.comparison.label}</dt><dd>{formatCurrency(costs.comparison.value)}</dd></div>}
          </dl>
        </div>
        {Object.entries(costs.sections).some(([, summary]) => hasSectionValue(summary)) && <div className="cost-group">
          <h3>Section totals</h3>
          <dl className="cost-list section-reconciliation">
            {Object.entries(costs.sections).filter(([, summary]) => hasSectionValue(summary)).map(([id, summary]) => <div key={id}>
              <dt>{sectionLabels[id] ?? id}</dt>
              <dd>
                {summary.monthlyCost > 0 && <span>{formatCurrency(summary.monthlyCost)}/mo cost</span>}
                {summary.oneTimeCost > 0 && <span>{formatCurrency(summary.oneTimeCost)} once</span>}
                {summary.totalCost > 0 && <span>{formatCurrency(summary.totalCost)} total cost</span>}
                {summary.monthlyCashFlow > 0 && <span>{formatCurrency(summary.monthlyCashFlow)}/mo planned</span>}
                {summary.oneTimeCashFlow !== 0 && <span>{formatCurrency(summary.oneTimeCashFlow)} planned once</span>}
                {summary.proceeds > 0 && <span>{formatCurrency(summary.proceeds)} proceeds</span>}
              </dd>
            </div>)}
          </dl>
        </div>}
        {additionalMetrics.length > 0 && <dl className="metric-list">{additionalMetrics.map((metric) => <div key={metric.id}><dt>{metric.label}</dt><dd>{formatMetric(metric)}</dd></div>)}</dl>}
      </section>
    </details>
    <details className="result-disclosure export-details">
      <summary>Export and share</summary>
      <div className="result-actions">
        <div className="action-group" role="group" aria-label="Share and save">
          <button type="button" className="primary-button" onClick={onShare} disabled={invalid}>Copy share link</button>
          <button type="button" className="secondary-button" onClick={onRemember} disabled={invalid}>Remember this scenario</button>
          <button type="button" className="secondary-button" onClick={onRestore} disabled={!hasRemembered}>Restore saved scenario</button>
          <button type="button" className="secondary-button danger-button" onClick={onDeleteRemembered} disabled={!hasRemembered}>Delete saved scenario</button>
        </div>
        <div className="action-group" role="group" aria-label="Print and export">
          <button type="button" className="secondary-button" onClick={onPrint} disabled={invalid}>Print / Save PDF</button>
          <button type="button" className="secondary-button" onClick={onCsv} disabled={invalid || exporting}>Download CSV</button>
          <button type="button" className="secondary-button" onClick={onXlsx} disabled={invalid || exporting}>{exporting ? 'Preparing Excel…' : 'Download Excel'}</button>
        </div>
      </div>
    </details>
    {status && <p className="status-message" aria-live="polite">{status}</p>}
  </div>
}
