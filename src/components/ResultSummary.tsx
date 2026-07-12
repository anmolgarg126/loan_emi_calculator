import type { SuiteResult, ViewMetric } from '../domain/calculators'
import { formatCurrency } from '../domain/loan'

const formatMetric = (metric: ViewMetric) => {
  if (metric.format === 'currency') return formatCurrency(Number(metric.value))
  if (metric.format === 'percentage') return `${Number(metric.value).toFixed(2)}%`
  if (metric.format === 'date') return new Date(`${metric.value}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return String(metric.value)
}

export function ResultSummary({ current, displayed, shared, hasUndo, hasRemembered, exporting, status, onReset, onUndo, onRemember, onRestore, onDeleteRemembered, onShare, onPrint, onCsv, onXlsx }: {
  current: SuiteResult
  displayed: SuiteResult
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
  return <div className="results-sticky">
    <div className="result-heading"><div><span>{current.kind === 'home' ? 'Home loan result' : `${current.kind[0]?.toUpperCase()}${current.kind.slice(1)} loan result`}</span><h2>Your repayment view</h2></div><button type="button" className="text-button" onClick={onReset}>Reset calculator</button></div>
    {shared && <p className="shared-badge">Loaded from a shared link. Editing keeps this tab independent.</p>}
    {invalid && <div className="validation-summary" role="alert"><strong>Check the highlighted inputs.</strong><p>The figures below remain the last valid estimate.</p><ul>{current.view.errors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}</ul></div>}
    <div className="primary-result"><span>{displayed.view.primary.label}</span><strong>{formatMetric(displayed.view.primary)}</strong><small>{displayed.kind === 'home' ? 'Standard loan before optional OD comparison' : 'Based on the current scenario'}</small></div>
    <dl className="metric-list">{displayed.view.metrics.map((metric) => <div key={metric.id}><dt>{metric.label}</dt><dd>{formatMetric(metric)}</dd></div>)}</dl>
    <div className="result-actions">
      <button type="button" className="primary-button" onClick={onShare} disabled={invalid}>Copy share link</button>
      <button type="button" className="secondary-button" onClick={onRemember} disabled={invalid}>Remember this scenario</button>
      <button type="button" className="secondary-button" onClick={onRestore} disabled={!hasRemembered}>Restore saved scenario</button>
      <button type="button" className="secondary-button danger-button" onClick={onDeleteRemembered} disabled={!hasRemembered}>Delete saved scenario</button>
      <button type="button" className="secondary-button" onClick={onPrint} disabled={invalid}>Print / Save PDF</button>
      <button type="button" className="secondary-button" onClick={onCsv} disabled={invalid || exporting}>Download CSV</button>
      <button type="button" className="secondary-button" onClick={onXlsx} disabled={invalid || exporting}>{exporting ? 'Preparing Excel…' : 'Download Excel'}</button>
      {hasUndo && <button type="button" className="secondary-button" onClick={onUndo}>Undo reset</button>}
    </div>
    {status && <p className="status-message" aria-live="polite">{status}</p>}
  </div>
}
