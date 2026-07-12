import type { ReactNode } from 'react'

export function GuidedSection({ step, title, description, optional = false, configured = false, open, onToggle, children }: {
  step: number
  title: string
  description: string
  optional?: boolean
  configured?: boolean
  open?: boolean
  onToggle?: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <details className="guided-section" open={open} onToggle={(event) => onToggle?.(event.currentTarget.open)}>
      <summary>
        <span className="step-number" aria-hidden="true">{step}</span>
        <span className="section-summary-copy">
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className={configured ? 'section-state configured' : 'section-state'}>
          {configured ? 'Configured' : optional ? 'Optional' : 'Required'}
        </span>
        <span className="summary-mark" aria-hidden="true">+</span>
      </summary>
      <div className="guided-body">{children}</div>
    </details>
  )
}
