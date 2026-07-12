import { addMonths, type CalculationResult, type LoanScenario, type OdTransaction } from '../../domain/loan'
import { formatAmountHelper, formatIndianAmountInput } from '../../lib/indian-amount'
import { DateField, ModeToggle, NumberField, SelectField, Switch } from '../CalculatorFields'
import { GuidedSection } from '../GuidedSection'
import { PrepaymentFields, RateChangeFields } from './LoanEventFields'

const id = () => crypto.randomUUID()

export function HomeForm({ scenario, result, onChange, issueFor }: {
  scenario: LoanScenario
  result: CalculationResult
  onChange: (scenario: LoanScenario) => void
  issueFor: (field: string) => string | undefined
}) {
  const set = <K extends keyof LoanScenario>(key: K, value: LoanScenario[K]) => onChange({ ...scenario, [key]: value })
  const setOd = <K extends keyof LoanScenario['od']>(key: K, value: LoanScenario['od'][K]) => onChange({ ...scenario, od: { ...scenario.od, [key]: value } })
  const updateTransaction = (index: number, patch: Partial<OdTransaction>) => setOd('transactions', scenario.od.transactions.map((item, position) => position === index ? { ...item, ...patch } : item))
  const percentageAmount = (value: number, mode: 'amount' | 'percent', base: number) =>
    mode === 'percent' && Number.isFinite(base) && base > 0 ? (value * base) / 100 : undefined
  return <div className="guided-form">
    <GuidedSection step={1} title="Home loan essentials" description="Property value, contribution, loan rate, and term" open>
      <div className="field-grid">
        <NumberField id="home-value" label="Home value" value={scenario.homeValue} onChange={(value) => set('homeValue', value)} prefix="₹" error={issueFor('homeValue')} />
        <div className="field-with-mode"><NumberField id="down-payment" label="Down payment" value={scenario.downPayment} onChange={(value) => set('downPayment', value)} prefix={scenario.downPaymentMode === 'amount' ? '₹' : undefined} suffix={scenario.downPaymentMode === 'percent' ? '%' : undefined} amountValue={percentageAmount(scenario.downPayment, scenario.downPaymentMode, scenario.homeValue)} equivalentAmount={scenario.downPaymentMode === 'percent'} error={issueFor('downPayment')} /><ModeToggle id="down-payment-mode" value={scenario.downPaymentMode} onChange={(value) => set('downPaymentMode', value)} percentLabel="% of home" error={issueFor('downPaymentMode')} /></div>
        <NumberField id="loan-insurance" label="Financed loan insurance" value={scenario.loanInsurance} onChange={(value) => set('loanInsurance', value)} prefix="₹" error={issueFor('loanInsurance')} />
        <label className="field" htmlFor="loan-amount"><span className="field-label">Calculated loan amount</span><span className="input-shell read-only"><span className="input-affix">₹</span><input id="loan-amount" aria-label="Calculated loan amount" aria-describedby="loan-amount-words loan-amount-hint" value={formatIndianAmountInput(Math.round(result.loanAmount))} readOnly /></span><small id="loan-amount-words" className="amount-helper">{formatAmountHelper(Math.round(result.loanAmount))}</small><small id="loan-amount-hint">Home value + financed insurance − down payment</small></label>
        <NumberField id="interest-rate" label="Annual interest rate" value={scenario.annualRate} onChange={(value) => set('annualRate', value)} suffix="%" max={50} step={0.01} error={issueFor('annualRate')} />
        <NumberField id="tenure" label="Loan tenure" value={scenario.tenureMonths} onChange={(value) => set('tenureMonths', Math.round(value))} suffix="months" max={480} step={1} error={issueFor('tenureMonths')} />
        <DateField id="start-date" label="Loan / EMI cycle start" value={scenario.startDate} onChange={(value) => set('startDate', value)} hint="The first payment is one month later." error={issueFor('startDate')} />
      </div>
    </GuidedSection>
    <GuidedSection step={2} title="Ownership and lender costs" description="Fees and ongoing costs outside principal" optional configured={scenario.processingFee + scenario.oneTimeExpenses + scenario.propertyTaxAnnual + scenario.homeInsuranceAnnual + scenario.maintenanceMonthly > 0}>
      <div className="field-grid">
        {([
          ['processingFee', 'processingFeeMode', 'Processing fee', '% of loan'],
          ['oneTimeExpenses', 'oneTimeExpensesMode', 'One-time purchase costs', '% of home'],
          ['propertyTaxAnnual', 'propertyTaxMode', 'Annual property tax', '% of home'],
          ['homeInsuranceAnnual', 'homeInsuranceMode', 'Annual home insurance', '% of home'],
        ] as const).map(([field, mode, label, percentLabel]) => {
          const entryMode = scenario[mode]
          const base = field === 'processingFee' ? result.loanAmount : scenario.homeValue
          return <div className="field-with-mode" key={field}><NumberField id={field} label={label} value={scenario[field]} onChange={(value) => set(field, value)} prefix={entryMode === 'amount' ? '₹' : undefined} suffix={entryMode === 'percent' ? '%' : undefined} amountValue={percentageAmount(scenario[field], entryMode, base)} equivalentAmount={entryMode === 'percent'} error={issueFor(field)} /><ModeToggle id={mode} value={entryMode} onChange={(value) => set(mode, value)} percentLabel={percentLabel} error={issueFor(mode)} /></div>
        })}
        <NumberField id="maintenance-monthly" label="Monthly maintenance" value={scenario.maintenanceMonthly} onChange={(value) => set('maintenanceMonthly', value)} prefix="₹" error={issueFor('maintenanceMonthly')} />
      </div>
    </GuidedSection>
    <GuidedSection step={3} title="Repayment changes" description="Prepayments and future lender rate resets" optional configured={scenario.prepayments.length + scenario.rateChanges.length > 0}>
      <h3>Prepayments</h3><PrepaymentFields items={scenario.prepayments} startDate={scenario.startDate} onChange={(value) => set('prepayments', value)} issueFor={issueFor} />
      <h3>Rate changes</h3><RateChangeFields items={scenario.rateChanges} startDate={scenario.startDate} onChange={(value) => set('rateChanges', value)} issueFor={issueFor} />
    </GuidedSection>
    <GuidedSection step={4} title="Overdraft facility" description="Park surplus while keeping it available" optional configured={scenario.od.enabled}>
      <Switch id="od-enabled" checked={scenario.od.enabled} onChange={(value) => setOd('enabled', value)} label="Add overdraft facility" description="Off by default. Compare OD interest and fees with the standard loan." />
      {scenario.od.enabled && <div className="nested-fields">
        <div className="field-grid">
          <NumberField id="od-premium" label="Additional OD rate" value={scenario.od.premiumRate} onChange={(value) => setOd('premiumRate', value)} suffix="%" max={20} step={0.01} error={issueFor('od.premiumRate')} />
          <NumberField id="od-setup-fee" label="OD setup fee" value={scenario.od.setupFee} onChange={(value) => setOd('setupFee', value)} prefix="₹" error={issueFor('od.setupFee')} />
          <NumberField id="od-annual-fee" label="OD annual fee" value={scenario.od.annualFee} onChange={(value) => setOd('annualFee', value)} prefix="₹" error={issueFor('od.annualFee')} />
          <div className="field-with-mode"><NumberField id="od-opening" label="Opening parked amount" value={scenario.od.openingSurplus} onChange={(value) => setOd('openingSurplus', value)} prefix={scenario.od.openingSurplusMode === 'amount' ? '₹' : undefined} suffix={scenario.od.openingSurplusMode === 'percent' ? '%' : undefined} amountValue={percentageAmount(scenario.od.openingSurplus, scenario.od.openingSurplusMode, result.loanAmount)} equivalentAmount={scenario.od.openingSurplusMode === 'percent'} error={issueFor('od.openingSurplus')} /><ModeToggle id="od-opening-mode" value={scenario.od.openingSurplusMode} onChange={(value) => setOd('openingSurplusMode', value)} percentLabel="% of loan" error={issueFor('od.openingSurplusMode')} /></div>
          <NumberField id="od-monthly" label="Fixed monthly contribution" value={scenario.od.monthlyContribution} onChange={(value) => setOd('monthlyContribution', value)} prefix="₹" error={issueFor('od.monthlyContribution')} />
        </div>
        <Switch id="od-transactions-enabled" checked={scenario.od.transactionsEnabled} onChange={(value) => setOd('transactionsEnabled', value)} label="Add dated deposits and withdrawals" description="Optional. Each entry stays local to this tab and device." />
        {scenario.od.transactionsEnabled && <div className="entry-editor">
          {scenario.od.transactions.map((item, index) => <div className="entry-row" key={item.id}>
            <DateField id={`od-${item.id}-date`} label="Transaction date" value={item.date} onChange={(date) => updateTransaction(index, { date })} error={issueFor(`od.transactions.${item.id}.date`)} />
            <SelectField id={`od-${item.id}-type`} label="Type" value={item.type} onChange={(type) => updateTransaction(index, { type: type as OdTransaction['type'] })} error={issueFor(`od.transactions.${item.id}.type`)}><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></SelectField>
            <NumberField id={`od-${item.id}-amount`} label="Amount" value={item.amount} onChange={(amount) => updateTransaction(index, { amount })} prefix="₹" error={issueFor(`od.transactions.${item.id}.amount`)} />
            <button type="button" className="remove-button" onClick={() => setOd('transactions', scenario.od.transactions.filter((_, position) => position !== index))}>Remove</button>
          </div>)}
          <button type="button" className="secondary-button" disabled={scenario.od.transactions.length >= 100} onClick={() => setOd('transactions', [...scenario.od.transactions, { id: id(), date: addMonths(scenario.startDate, 1), type: 'deposit', amount: 0 }])}>Add transaction</button>
        </div>}
      </div>}
    </GuidedSection>
  </div>
}
