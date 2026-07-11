import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CostChart, BalanceChart } from './components/Charts'
import { Schedule } from './components/Schedule'
import {
  addMonths,
  calculateLoan,
  defaultScenario,
  formatCurrency,
  type LoanScenario,
  type MoneyMode,
} from './domain/loan'
import { copyScenarioUrl, decodeScenario } from './lib/share'
import { downloadCsv, downloadXlsx } from './lib/exports'

const newId = () => crypto.randomUUID()

function NumberField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max,
  step = 'any',
  hint,
  error,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number | 'any'
  hint?: string
  error?: string
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="input-shell">
        {prefix && <span className="input-affix">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}
        />
        {suffix && <span className="input-affix">{suffix}</span>}
      </span>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className="field-error">{error}</small>}
    </label>
  )
}

function DateField({ id, label, value, onChange, hint, error }: { id: string; label: string; value: string; onChange: (value: string) => void; hint?: string; error?: string }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="input-shell">
        <input id={id} type="date" value={value} aria-describedby={describedBy} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
      </span>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className="field-error">{error}</small>}
    </label>
  )
}

function SelectField({ id, label, value, onChange, error, children }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; children: ReactNode }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="input-shell">
        <select id={id} value={value} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)}>{children}</select>
      </span>
      {error && <small id={`${id}-error`} className="field-error">{error}</small>}
    </label>
  )
}

function ModeToggle({ id, value, onChange, percentLabel = '% of base', hint, error }: { id: string; value: MoneyMode; onChange: (value: MoneyMode) => void; percentLabel?: string; hint?: string; error?: string }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <fieldset id={id} className="mode-field" aria-describedby={describedBy} aria-invalid={Boolean(error)}>
      <legend>Entry unit</legend>
      <span className="segmented">
        <button type="button" className={value === 'amount' ? 'active' : ''} onClick={() => onChange('amount')} aria-pressed={value === 'amount'}>
          ₹
        </button>
        <button type="button" className={value === 'percent' ? 'active' : ''} onClick={() => onChange('percent')} aria-pressed={value === 'percent'}>
          {percentLabel}
        </button>
      </span>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className="field-error">{error}</small>}
    </fieldset>
  )
}

function Section({ title, eyebrow, children, open = false }: { title: string; eyebrow: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="form-section" open={open}>
      <summary>
        <span>
          <small>{eyebrow}</small>
          <strong>{title}</strong>
        </span>
        <span className="summary-mark" aria-hidden="true">+</span>
      </summary>
      <div className="section-body">{children}</div>
    </details>
  )
}

function Switch({ id, checked, onChange, label, description }: { id: string; checked: boolean; onChange: (checked: boolean) => void; label: string; description: string }) {
  return (
    <label className="switch-row" htmlFor={id}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="switch-control">
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span aria-hidden="true" />
      </span>
    </label>
  )
}

function App() {
  const sharedScenario = useMemo(() => decodeScenario(window.location.hash), [])
  const [model, setModel] = useState(() => {
    const scenario = sharedScenario ?? defaultScenario()
    const currentResult = calculateLoan(scenario)
    return { scenario, currentResult, lastValidResult: currentResult, shared: Boolean(sharedScenario) }
  })
  const scenario = model.scenario
  const [status, setStatus] = useState(() => window.location.hash && !sharedScenario ? 'The shared scenario link was invalid and has been ignored.' : '')
  const [exporting, setExporting] = useState(false)
  const calculatedResult = model.currentResult
  const result = calculatedResult.errors.length === 0 ? calculatedResult : model.lastValidResult

  useEffect(() => {
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ?? document.head.appendChild(document.createElement('link'))
    canonical.rel = 'canonical'
    canonical.href = import.meta.env.VITE_SITE_URL || new URL(import.meta.env.BASE_URL, window.location.origin).toString()
  }, [])

  const setNextScenario = (nextScenario: LoanScenario, shared = false) => {
    const nextResult = calculateLoan(nextScenario)
    setModel((current) => ({
      scenario: nextScenario,
      currentResult: nextResult,
      lastValidResult: nextResult.errors.length === 0 ? nextResult : current.lastValidResult,
      shared,
    }))
  }
  const update = <K extends keyof LoanScenario>(key: K, value: LoanScenario[K]) =>
    setNextScenario({ ...scenario, [key]: value })
  const updateOd = <K extends keyof LoanScenario['od']>(key: K, value: LoanScenario['od'][K]) =>
    setNextScenario({ ...scenario, od: { ...scenario.od, [key]: value } })
  const issueFor = (field: string) => calculatedResult.issues.find((issue) => issue.field === field)?.message
  const actionsDisabled = calculatedResult.errors.length > 0

  const share = async () => {
    try {
      await copyScenarioUrl(scenario)
      setStatus('Share link copied. Financial inputs are encoded in the link only because you requested it.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to create share link.')
    }
  }

  const exportExcel = async () => {
    setExporting(true)
    setStatus('Preparing typed Excel workbook…')
    try {
      await downloadXlsx(result)
      setStatus('Excel workbook downloaded.')
    } catch {
      setStatus('Excel export failed. Your calculation is unchanged.')
    } finally {
      setExporting(false)
    }
  }

  const odPositive = result.od.enabled && result.od.feeAdjustedSavings >= 0
  const latestOd = result.od.schedule.at(-1)

  return (
    <>
      <div className="paper-grid" aria-hidden="true" />
      <header className="site-header">
        <a className="wordmark" href={import.meta.env.BASE_URL} aria-label="Loan Ledger home">
          <span>LL</span>
          <strong>LOAN LEDGER</strong>
        </a>
        <div className="header-meta">
          <span>INR</span>
          <span>ACTUAL / 365</span>
          <span>LOCAL-ONLY</span>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">HOME FINANCE / MODEL 01</div>
            <h1>Know the loan.<br /><em>Model the float.</em></h1>
            <p>
              A lender-neutral EMI and overdraft calculator that treats your surplus as liquidity—not a hidden prepayment.
            </p>
          </div>
          <aside className="hero-note">
            <span>01</span>
            <p>All calculations happen in this browser. Nothing is uploaded unless you deliberately share the generated URL.</p>
          </aside>
        </section>

        <div className="calculator-layout">
          <section className="calculator-panel" aria-labelledby="inputs-title">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">INPUT LEDGER</div>
                <h2 id="inputs-title">Build your scenario</h2>
              </div>
              <button type="button" className="text-button" onClick={() => { setNextScenario(defaultScenario()); setStatus('Scenario reset.') }}>Reset</button>
            </div>

            <div className="form-section always-open">
              <div className="section-body">
                <div className="field-grid">
                  <NumberField id="home-value" label="Home value" value={scenario.homeValue} onChange={(value) => update('homeValue', value)} prefix="₹" error={issueFor('homeValue')} />
                  <div className="field-with-mode">
                    <NumberField id="down-payment" label="Down payment" value={scenario.downPayment} onChange={(value) => update('downPayment', value)} suffix={scenario.downPaymentMode === 'percent' ? '%' : undefined} prefix={scenario.downPaymentMode === 'amount' ? '₹' : undefined} error={issueFor('downPayment')} />
                    <ModeToggle id="down-payment-mode" value={scenario.downPaymentMode} onChange={(value) => update('downPaymentMode', value)} percentLabel="% home" error={issueFor('downPaymentMode')} />
                  </div>
                  <NumberField id="loan-insurance" label="Financed loan insurance" value={scenario.loanInsurance} onChange={(value) => update('loanInsurance', value)} prefix="₹" error={issueFor('loanInsurance')} />
                  <label className="field" htmlFor="loan-amount">
                    <span className="field-label">Calculated loan amount</span>
                    <span className="input-shell read-only"><span className="input-affix">₹</span><input id="loan-amount" value={Math.round(result.loanAmount)} aria-describedby={`loan-amount-hint${issueFor('loanAmount') ? ' loan-amount-error' : ''}`} aria-invalid={Boolean(issueFor('loanAmount'))} readOnly /></span>
                    <small id="loan-amount-hint">Home value + financed insurance − down payment</small>
                    {issueFor('loanAmount') && <small id="loan-amount-error" className="field-error">{issueFor('loanAmount')}</small>}
                  </label>
                  <NumberField id="interest-rate" label="Annual interest rate" value={scenario.annualRate} onChange={(value) => update('annualRate', value)} suffix="%" max={50} step={0.01} error={issueFor('annualRate')} />
                  <NumberField id="tenure" label="Loan tenure" value={scenario.tenureMonths} onChange={(value) => update('tenureMonths', Math.round(value))} suffix="months" max={480} step={1} error={issueFor('tenureMonths')} />
                  <DateField id="start-date" label="Loan / EMI cycle start" value={scenario.startDate} onChange={(value) => update('startDate', value)} hint="First payment is one month after this date." error={issueFor('startDate')} />
                  <div className="field-with-mode">
                    <NumberField id="processing-fee" label="Processing fee" value={scenario.processingFee} onChange={(value) => update('processingFee', value)} suffix={scenario.processingFeeMode === 'percent' ? '%' : undefined} prefix={scenario.processingFeeMode === 'amount' ? '₹' : undefined} error={issueFor('processingFee')} />
                    <ModeToggle id="processing-fee-mode" value={scenario.processingFeeMode} onChange={(value) => update('processingFeeMode', value)} percentLabel="% loan" error={issueFor('processingFeeMode')} />
                  </div>
                </div>
              </div>
            </div>

            <Section title="Homeowner costs" eyebrow="OPTIONAL / OWNERSHIP">
              <div className="field-grid">
                <div className="field-with-mode">
                  <NumberField id="one-time" label="One-time expenses" value={scenario.oneTimeExpenses} onChange={(value) => update('oneTimeExpenses', value)} suffix={scenario.oneTimeExpensesMode === 'percent' ? '%' : undefined} prefix={scenario.oneTimeExpensesMode === 'amount' ? '₹' : undefined} error={issueFor('oneTimeExpenses')} />
                  <ModeToggle id="one-time-mode" value={scenario.oneTimeExpensesMode} onChange={(value) => update('oneTimeExpensesMode', value)} percentLabel="% home" error={issueFor('oneTimeExpensesMode')} />
                </div>
                <div className="field-with-mode">
                  <NumberField id="property-tax" label="Property tax / year" value={scenario.propertyTaxAnnual} onChange={(value) => update('propertyTaxAnnual', value)} suffix={scenario.propertyTaxMode === 'percent' ? '%' : undefined} prefix={scenario.propertyTaxMode === 'amount' ? '₹' : undefined} error={issueFor('propertyTaxAnnual')} />
                  <ModeToggle id="property-tax-mode" value={scenario.propertyTaxMode} onChange={(value) => update('propertyTaxMode', value)} percentLabel="% home" error={issueFor('propertyTaxMode')} />
                </div>
                <div className="field-with-mode">
                  <NumberField id="home-insurance" label="Home insurance / year" value={scenario.homeInsuranceAnnual} onChange={(value) => update('homeInsuranceAnnual', value)} suffix={scenario.homeInsuranceMode === 'percent' ? '%' : undefined} prefix={scenario.homeInsuranceMode === 'amount' ? '₹' : undefined} error={issueFor('homeInsuranceAnnual')} />
                  <ModeToggle id="home-insurance-mode" value={scenario.homeInsuranceMode} onChange={(value) => update('homeInsuranceMode', value)} percentLabel="% home" error={issueFor('homeInsuranceMode')} />
                </div>
                <NumberField id="maintenance" label="Maintenance / month" value={scenario.maintenanceMonthly} onChange={(value) => update('maintenanceMonthly', value)} prefix="₹" error={issueFor('maintenanceMonthly')} />
              </div>
              <p className="inline-note">Ownership costs are kept constant and compared over the original contracted tenure. They never inflate OD savings.</p>
            </Section>

            <Section title="Prepayments" eyebrow="OPTIONAL / PERMANENT">
              <p className="section-copy">Prepayments permanently reduce principal and must fall on an EMI cycle date.</p>
              <div className="entry-list">
                {scenario.prepayments.map((item, index) => (
                  <div className="entry-row" key={item.id}>
                    <DateField id={`prepayment-date-${item.id}`} label="First date" value={item.date} onChange={(date) => update('prepayments', scenario.prepayments.map((current) => current.id === item.id ? { ...current, date } : current))} error={issueFor(`prepayments.${item.id}.date`)} />
                    <NumberField id={`prepayment-amount-${item.id}`} label="Amount" value={item.amount} onChange={(amount) => update('prepayments', scenario.prepayments.map((current) => current.id === item.id ? { ...current, amount } : current))} prefix="₹" error={issueFor(`prepayments.${item.id}.amount`)} />
                    <SelectField id={`prepayment-frequency-${item.id}`} label="Frequency" value={item.frequency} error={issueFor(`prepayments.${item.id}.frequency`)} onChange={(frequency) => update('prepayments', scenario.prepayments.map((current) => current.id === item.id ? { ...current, frequency: frequency as typeof item.frequency } : current))}>
                      <option value="once">One-time</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
                    </SelectField>
                    <button type="button" className="remove-button" onClick={() => update('prepayments', scenario.prepayments.filter((current) => current.id !== item.id))} aria-label={`Remove prepayment ${index + 1}`}>Remove</button>
                  </div>
                ))}
              </div>
              <button type="button" className="add-button" onClick={() => update('prepayments', [...scenario.prepayments, { id: newId(), date: addMonths(scenario.startDate, 1), amount: 0, frequency: 'once' }])}>+ Add prepayment</button>
            </Section>

            <Section title="Interest-rate changes" eyebrow="OPTIONAL / FLOATING">
              <p className="section-copy">Changes take effect on an EMI cycle date. Keep-EMI mode adjusts tenure by default.</p>
              <div className="entry-list">
                {scenario.rateChanges.map((item, index) => (
                  <div className="entry-row" key={item.id}>
                    <DateField id={`rate-date-${item.id}`} label="Effective date" value={item.date} onChange={(date) => update('rateChanges', scenario.rateChanges.map((current) => current.id === item.id ? { ...current, date } : current))} error={issueFor(`rateChanges.${item.id}.date`)} />
                    <NumberField id={`rate-value-${item.id}`} label="New annual rate" value={item.annualRate} onChange={(annualRate) => update('rateChanges', scenario.rateChanges.map((current) => current.id === item.id ? { ...current, annualRate } : current))} suffix="%" max={50} step={0.01} error={issueFor(`rateChanges.${item.id}.annualRate`)} />
                    <SelectField id={`rate-mode-${item.id}`} label="Adjustment" value={item.mode} error={issueFor(`rateChanges.${item.id}.mode`)} onChange={(mode) => update('rateChanges', scenario.rateChanges.map((current) => current.id === item.id ? { ...current, mode: mode as typeof item.mode } : current))}>
                      <option value="keep-emi">Keep EMI, adjust tenure</option><option value="keep-tenure">Keep tenure, recalculate EMI</option>
                    </SelectField>
                    <button type="button" className="remove-button" onClick={() => update('rateChanges', scenario.rateChanges.filter((current) => current.id !== item.id))} aria-label={`Remove rate change ${index + 1}`}>Remove</button>
                  </div>
                ))}
              </div>
              <button type="button" className="add-button" onClick={() => update('rateChanges', [...scenario.rateChanges, { id: newId(), date: addMonths(scenario.startDate, 12), annualRate: scenario.annualRate, mode: 'keep-emi' }])}>+ Add rate change</button>
            </Section>

            <Section title="Overdraft facility" eyebrow="OPTIONAL / DAILY REST" open={scenario.od.enabled}>
              <Switch id="od-enabled" checked={scenario.od.enabled} onChange={(checked) => updateOd('enabled', checked)} label="Model an OD-linked home loan" description="Off by default. Deposited surplus stays withdrawable and only reduces interest-bearing utilization." />
              {scenario.od.enabled && (
                <div className="od-fields">
                  <div className="field-grid">
                    <NumberField id="od-premium" label="OD rate premium" value={scenario.od.premiumRate} onChange={(value) => updateOd('premiumRate', value)} suffix="%" max={20} step={0.01} hint={`Effective initial OD rate: ${(scenario.annualRate + scenario.od.premiumRate).toFixed(2)}%`} error={issueFor('od.premiumRate')} />
                    <NumberField id="od-setup-fee" label="One-time OD setup fee" value={scenario.od.setupFee} onChange={(value) => updateOd('setupFee', value)} prefix="₹" error={issueFor('od.setupFee')} />
                    <NumberField id="od-annual-fee" label="Annual OD account fee" value={scenario.od.annualFee} onChange={(value) => updateOd('annualFee', value)} prefix="₹" error={issueFor('od.annualFee')} />
                    <div className="field-with-mode">
                      <NumberField id="opening-surplus" label="Opening parked surplus" value={scenario.od.openingSurplus} onChange={(value) => updateOd('openingSurplus', value)} suffix={scenario.od.openingSurplusMode === 'percent' ? '%' : undefined} prefix={scenario.od.openingSurplusMode === 'amount' ? '₹' : undefined} error={issueFor('od.openingSurplus')} />
                      <ModeToggle id="opening-surplus-mode" value={scenario.od.openingSurplusMode} onChange={(value) => updateOd('openingSurplusMode', value)} percentLabel="% loan" error={issueFor('od.openingSurplusMode')} />
                    </div>
                    <NumberField id="monthly-surplus" label="Monthly parked contribution" value={scenario.od.monthlyContribution} onChange={(value) => updateOd('monthlyContribution', value)} prefix="₹" hint="Deposited on each EMI date after the scheduled transfer." error={issueFor('od.monthlyContribution')} />
                  </div>
                  <Switch id="od-transactions" checked={scenario.od.transactionsEnabled} onChange={(checked) => updateOd('transactionsEnabled', checked)} label="Dated deposits and withdrawals" description="Optional and off by default. Up to 100 calendar-dated entries." />
                  {scenario.od.transactionsEnabled && (
                    <div className="entry-list od-entries">
                      {scenario.od.transactions.map((item, index) => (
                        <div className="entry-row transaction-row" key={item.id}>
                          <DateField id={`transaction-date-${item.id}`} label="Date" value={item.date} onChange={(date) => updateOd('transactions', scenario.od.transactions.map((current) => current.id === item.id ? { ...current, date } : current))} error={issueFor(`od.transactions.${item.id}.date`)} />
                          <SelectField id={`transaction-type-${item.id}`} label="Type" value={item.type} error={issueFor(`od.transactions.${item.id}.type`)} onChange={(type) => updateOd('transactions', scenario.od.transactions.map((current) => current.id === item.id ? { ...current, type: type as typeof item.type } : current))}>
                            <option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option>
                          </SelectField>
                          <NumberField id={`transaction-amount-${item.id}`} label="Amount" value={item.amount} onChange={(amount) => updateOd('transactions', scenario.od.transactions.map((current) => current.id === item.id ? { ...current, amount } : current))} prefix="₹" error={issueFor(`od.transactions.${item.id}.amount`)} />
                          <button type="button" className="remove-button" onClick={() => updateOd('transactions', scenario.od.transactions.filter((current) => current.id !== item.id))} aria-label={`Remove OD transaction ${index + 1}`}>Remove</button>
                        </div>
                      ))}
                      <button type="button" className="add-button" disabled={scenario.od.transactions.length >= 100} onClick={() => updateOd('transactions', [...scenario.od.transactions, { id: newId(), date: scenario.startDate, type: 'deposit', amount: 0 }])}>+ Add OD transaction</button>
                    </div>
                  )}
                </div>
              )}
            </Section>
          </section>

          <aside className="results-panel" aria-labelledby="results-title">
            <div className="results-sticky">
              <div className="section-kicker">LIVE RESULT</div>
              <h2 id="results-title">The monthly number</h2>
              {model.shared && (
                <aside className="shared-notice" role="status">
                  Loaded from a shared link—verify every input. Anyone with this URL can read its financial values.
                </aside>
              )}
              <div className="primary-number">
                <span>STANDARD EMI</span>
                <strong>{formatCurrency(result.standard.initialEmi)}</strong>
                <small>+ {formatCurrency(result.monthlyOwnershipCost)} ownership provision</small>
              </div>
              <dl className="result-ledger">
                <div><dt>Loan amount</dt><dd>{formatCurrency(result.loanAmount)}</dd></div>
                <div><dt>Upfront cash</dt><dd>{formatCurrency(result.upfrontCash)}</dd></div>
                <div><dt>Total standard interest</dt><dd>{formatCurrency(result.standard.totalInterest)}</dd></div>
                <div><dt>Standard payoff</dt><dd>{result.standard.payoffDate}</dd></div>
              </dl>

              {result.od.enabled && (
                <div className={`od-comparison ${odPositive ? 'positive' : 'negative'}`}>
                  <span>OD RESULT / AFTER FEES</span>
                  <strong>{odPositive ? 'SAVE ' : 'COST '}{formatCurrency(Math.abs(result.od.feeAdjustedSavings))}</strong>
                  <dl>
                    <div><dt>OD interest</dt><dd>{formatCurrency(result.od.totalInterest)}</dd></div>
                    <div><dt>OD fees</dt><dd>{formatCurrency(result.od.totalFees)}</dd></div>
                    <div><dt>Net debt-free</dt><dd>{result.od.netDebtFreeDate ?? 'Not before payoff'}</dd></div>
                    <div><dt>Ending parked liquidity</dt><dd>{formatCurrency(result.od.endingParkedSurplus)}</dd></div>
                  </dl>
                </div>
              )}

              {result.od.enabled && (
                <dl className="result-ledger od-balances">
                  <div><dt>Effective initial OD rate</dt><dd>{result.od.effectiveInitialRate.toFixed(2)}%</dd></div>
                  <div><dt>One-time OD fee</dt><dd>{formatCurrency(result.scenario.od.setupFee)}</dd></div>
                  <div><dt>Annual OD fees</dt><dd>{formatCurrency(Math.max(0, result.od.totalFees - result.scenario.od.setupFee))}</dd></div>
                  <div><dt>Contractual payoff</dt><dd>{result.od.contractualPayoffDate}</dd></div>
                  <div><dt>Drawing power</dt><dd>{formatCurrency(latestOd?.drawingPower ?? result.loanAmount)}</dd></div>
                  <div><dt>Parked surplus</dt><dd>{formatCurrency(latestOd?.parkedSurplus ?? 0)}</dd></div>
                  <div><dt>Available withdrawal</dt><dd>{formatCurrency(latestOd?.availableWithdrawal ?? 0)}</dd></div>
                  <div><dt>Net utilized balance</dt><dd>{formatCurrency(latestOd?.netUtilized ?? result.loanAmount)}</dd></div>
                  <div><dt>Last posted OD interest</dt><dd>{formatCurrency(latestOd?.interest ?? 0)}</dd></div>
                </dl>
              )}

              {(calculatedResult.errors.length > 0 || calculatedResult.warnings.length > 0) && (
                <div className="messages" aria-live="polite">
                  {calculatedResult.errors.map((message) => <p className="error" key={message}>{message}</p>)}
                  {calculatedResult.warnings.map((message) => <p className="warning" key={message}>{message}</p>)}
                </div>
              )}

              <div className="action-grid">
                <button type="button" onClick={share} disabled={actionsDisabled}>Copy share link</button>
                <button type="button" onClick={() => window.print()} disabled={actionsDisabled}>Print / Save PDF</button>
                <button type="button" onClick={() => downloadCsv(result)} disabled={actionsDisabled}>Download CSV</button>
                <button type="button" onClick={exportExcel} disabled={exporting || actionsDisabled}>{exporting ? 'Preparing…' : 'Download Excel'}</button>
              </div>
              <p className="status" aria-live="polite">{status}</p>
            </div>
          </aside>
        </div>

        <section className="totals-band" aria-label="Lifetime totals">
          <div><span>STANDARD OUTFLOW</span><strong>{formatCurrency(result.standard.totalModelledOutflow)}</strong><small>includes ownership costs over original tenure</small></div>
          <div><span>OD OUTFLOW</span><strong>{formatCurrency(result.od.totalModelledOutflow)}</strong><small>parked liquidity excluded</small></div>
          <div><span>OWNERSHIP COSTS</span><strong>{formatCurrency(result.ownershipCostOverOriginalTenure)}</strong><small>kept separate from OD savings</small></div>
        </section>

        <section className="charts-grid">
          <CostChart result={result} />
          <BalanceChart result={result} />
        </section>
        <Schedule result={result} />

        <section className="assumptions">
          <div className="section-kicker">READ BEFORE USING</div>
          <h2>A model, not a lender statement.</h2>
          <div className="assumption-grid">
            <p><strong>Daily OD rest.</strong> OD interest uses Actual/365 calendar days and rounds to paise at monthly posting.</p>
            <p><strong>Constant ownership costs.</strong> Tax, insurance, and maintenance do not inflate in this version.</p>
            <p><strong>Lender-neutral.</strong> Product-specific drawing-power, fee, and repayment rules can differ. Verify your sanction letter.</p>
          </div>
        </section>
      </main>

      <footer>
        <strong>LOAN LEDGER</strong>
        <span>Educational estimate · No data collection · Built for GitHub Pages</span>
      </footer>
    </>
  )
}

export default App
