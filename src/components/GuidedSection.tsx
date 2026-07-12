import type { ReactNode } from 'react'
import type { SectionCostSummary } from '../domain/calculators/cost-breakdown'
import { formatCurrency } from '../domain/loan'

export function GuidedSection({ step, title, description, optional = false, configured = false, open, onToggle, financial, children }: {
  step: number
  title: string
  description: string
  optional?: boolean
  configured?: boolean
  open?: boolean
  onToggle?: (open: boolean) => void
  financial?: SectionCostSummary
  children: ReactNode
}) {
  const hasFinancial = financial && Object.values(financial).some((value) => Math.abs(value) > 0.005)
  const brief = hasFinancial ? [
    financial.monthlyCost > 0 && `${formatCurrency(financial.monthlyCost)}/mo`,
    financial.oneTimeCost > 0 && `${formatCurrency(financial.oneTimeCost)} once`,
    financial.monthlyCashFlow > 0 && `${formatCurrency(financial.monthlyCashFlow)} cash/mo`,
    financial.oneTimeCashFlow > 0 && `${formatCurrency(financial.oneTimeCashFlow)} planned once`,
    financial.proceeds > 0 && `${formatCurrency(financial.proceeds)} proceeds`,
  ].filter((value): value is string => Boolean(value)) : []
  return (
    <details className="guided-section" open={open} onToggle={(event) => onToggle?.(event.currentTarget.open)}>
      <summary>
        <span className="step-number" aria-hidden="true">{step}</span>
        <span className="section-summary-copy">
          <strong>{title}</strong>
          <small>{description}</small>
          {brief.length > 0 && <small className="section-financial-brief">{brief.map((item) => <span key={item}>{item}</span>)}</small>}
        </span>
        <span className={configured ? 'section-state configured' : 'section-state'}>
          {configured ? 'Configured' : optional ? 'Optional' : 'Required'}
        </span>
        <span className="summary-mark" aria-hidden="true">+</span>
      </summary>
      <div className="guided-body">
        {hasFinancial && <dl className="section-financials">
          {financial.monthlyCost > 0 && <div><dt>Monthly cost</dt><dd>{formatCurrency(financial.monthlyCost)}</dd></div>}
          {financial.oneTimeCost > 0 && <div><dt>One-time cost</dt><dd>{formatCurrency(financial.oneTimeCost)}</dd></div>}
          {financial.totalCost > financial.oneTimeCost + 0.005 && <div><dt>Total section cost</dt><dd>{formatCurrency(financial.totalCost)}</dd></div>}
          {financial.monthlyCashFlow > 0 && <div><dt>Planned cash flow / month</dt><dd>{formatCurrency(financial.monthlyCashFlow)}</dd></div>}
          {financial.oneTimeCashFlow !== 0 && <div><dt>Planned one-time cash flow</dt><dd>{formatCurrency(financial.oneTimeCashFlow)}</dd></div>}
          {financial.totalCashFlow > Math.abs(financial.oneTimeCashFlow) + 0.005 && <div><dt>Total planned cash flow</dt><dd>{formatCurrency(financial.totalCashFlow)}</dd></div>}
          {financial.proceeds > 0 && <div><dt>Expected proceeds</dt><dd>{formatCurrency(financial.proceeds)}</dd></div>}
        </dl>}
        {children}
      </div>
    </details>
  )
}
