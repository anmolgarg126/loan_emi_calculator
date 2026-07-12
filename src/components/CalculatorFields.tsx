import { useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { MoneyMode } from '../domain/loan'
import { formatAmountHelper, formatIndianAmountInput, parseNumericDraft } from '../lib/indian-amount'

interface CommonFieldProps {
  id: string
  label: string
  hint?: string
  error?: string
}

export function NumberField({
  id, label, value, onChange, prefix, suffix, min = 0, max, step = 'any', hint, error, amountValue, equivalentAmount = false,
}: CommonFieldProps & {
  value: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number | 'any'
  amountValue?: number
  equivalentAmount?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const selectOnMouseUp = useRef(false)
  const monetary = prefix === '₹'
  const parsedDraft = draft === null ? value : parseNumericDraft(draft)
  const resolvedAmount = parsedDraft === null ? undefined : amountValue ?? (monetary ? parsedDraft : undefined)
  const amountHelper = resolvedAmount === undefined ? null : formatAmountHelper(resolvedAmount, equivalentAmount)
  const displayValue = draft ?? (monetary ? formatIndianAmountInput(value) : Number.isFinite(value) ? String(value) : '')
  const describedBy = [amountHelper && `${id}-amount`, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const startEditing = (input: HTMLInputElement) => {
    flushSync(() => setDraft(Number.isFinite(value) ? String(value) : ''))
    selectOnMouseUp.current = true
    input.select()
  }
  const edit = (next: string) => {
    const normalized = next.replaceAll(',', '')
    if (normalized !== '' && !/^\d+(?:\.\d*)?$/.test(normalized)) return
    setDraft(normalized)
    const parsed = parseNumericDraft(normalized)
    if (parsed !== null) onChange(parsed)
  }
  const finishEditing = () => {
    if (draft === '') onChange(0)
    setDraft(null)
  }
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="input-shell">
        {prefix && <span className="input-affix">{prefix}</span>}
        <input
          id={id}
          aria-label={label}
          type={monetary ? 'text' : 'number'}
          inputMode="decimal"
          value={displayValue}
          min={min}
          max={max}
          step={step}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          onFocus={(event) => startEditing(event.currentTarget)}
          onMouseUp={(event) => {
            if (!selectOnMouseUp.current) return
            event.preventDefault()
            selectOnMouseUp.current = false
            event.currentTarget.select()
          }}
          onChange={(event) => edit(event.target.value)}
          onBlur={finishEditing}
        />
        {suffix && <span className="input-affix">{suffix}</span>}
      </span>
      {amountHelper && <small id={`${id}-amount`} className="amount-helper">{amountHelper}</small>}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className="field-error" role="alert">{error}</small>}
    </label>
  )
}

export function DateField({ id, label, value, onChange, hint, error }: CommonFieldProps & {
  value: string
  onChange: (value: string) => void
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="input-shell">
        <input id={id} type="date" value={value} aria-label={label} aria-describedby={describedBy} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
      </span>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className="field-error" role="alert">{error}</small>}
    </label>
  )
}

export function SelectField({ id, label, value, onChange, error, children }: CommonFieldProps & {
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="input-shell">
        <select id={id} value={value} aria-label={label} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)}>{children}</select>
      </span>
      {error && <small id={`${id}-error`} className="field-error" role="alert">{error}</small>}
    </label>
  )
}

export function ModeToggle({ id, value, onChange, percentLabel = '% of base', hint, error }: {
  id: string
  value: MoneyMode
  onChange: (value: MoneyMode) => void
  percentLabel?: string
  hint?: string
  error?: string
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <fieldset className="mode-field" aria-describedby={describedBy} aria-invalid={Boolean(error)}>
      <legend>Entry unit</legend>
      <span className="segmented" id={id}>
        <button type="button" className={value === 'amount' ? 'active' : ''} onClick={() => onChange('amount')} aria-pressed={value === 'amount'}>₹ amount</button>
        <button type="button" className={value === 'percent' ? 'active' : ''} onClick={() => onChange('percent')} aria-pressed={value === 'percent'}>{percentLabel}</button>
      </span>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className="field-error" role="alert">{error}</small>}
    </fieldset>
  )
}

export function Switch({ id, checked, onChange, label, description }: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description: string
}) {
  return (
    <label className="switch-row" htmlFor={id}>
      <span><strong>{label}</strong><small>{description}</small></span>
      <span className="switch-control">
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span aria-hidden="true" />
      </span>
    </label>
  )
}
