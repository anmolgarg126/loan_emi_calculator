import type { PersonalScenario } from '../../domain/calculators'
import { DateField, ModeToggle, NumberField, SelectField } from '../CalculatorFields'
import { GuidedSection } from '../GuidedSection'
import { PrepaymentFields } from './LoanEventFields'

export function PersonalForm({ scenario, onChange, issueFor }: {
  scenario: PersonalScenario
  onChange: (scenario: PersonalScenario) => void
  issueFor: (field: string) => string | undefined
}) {
  const set = <K extends keyof PersonalScenario>(key: K, value: PersonalScenario[K]) => onChange({ ...scenario, [key]: value })
  const processingFeeAmount = scenario.processingFeeMode === 'percent' && scenario.principal > 0
    ? (scenario.processingFee * scenario.principal) / 100
    : undefined
  return <div className="guided-form">
    <GuidedSection step={1} title="Personal loan essentials" description="Requested amount, lender quote, and repayment term" open>
      <div className="field-grid">
        <NumberField id="personal-principal" label="Requested loan amount" value={scenario.principal} onChange={(value) => set('principal', value)} prefix="₹" error={issueFor('principal')} />
        <NumberField id="personal-rate" label="Quoted annual rate" value={scenario.quotedAnnualRate} onChange={(value) => set('quotedAnnualRate', value)} suffix="%" max={50} step={0.01} error={issueFor('quotedAnnualRate')} />
        <SelectField id="quotation-mode" label="Quotation method" value={scenario.quotationMode} onChange={(value) => set('quotationMode', value as PersonalScenario['quotationMode'])} error={issueFor('quotationMode')}><option value="reducing">Reducing balance</option><option value="flat">Flat rate</option></SelectField>
        <NumberField id="personal-tenure" label="Loan tenure" value={scenario.tenureMonths} onChange={(value) => set('tenureMonths', Math.round(value))} suffix="months" max={480} step={1} error={issueFor('tenureMonths')} />
        <DateField id="personal-start" label="First EMI date" value={scenario.startDate} onChange={(value) => set('startDate', value)} error={issueFor('startDate')} />
      </div>
    </GuidedSection>
    <GuidedSection step={2} title="Upfront deductions" description="See the amount you actually receive" optional configured={scenario.processingFee + scenario.insuranceDeduction + scenario.otherDeduction > 0}>
      <div className="field-grid">
        <div className="field-with-mode"><NumberField id="personal-fee" label="Processing fee" value={scenario.processingFee} onChange={(value) => set('processingFee', value)} prefix={scenario.processingFeeMode === 'amount' ? '₹' : undefined} suffix={scenario.processingFeeMode === 'percent' ? '%' : undefined} amountValue={processingFeeAmount} equivalentAmount={scenario.processingFeeMode === 'percent'} error={issueFor('processingFee')} /><ModeToggle id="personal-fee-mode" value={scenario.processingFeeMode} onChange={(value) => set('processingFeeMode', value)} percentLabel="% of principal" error={issueFor('processingFeeMode')} /></div>
        <NumberField id="gst-rate" label="GST on processing fee" value={scenario.gstRate} onChange={(value) => set('gstRate', value)} suffix="%" max={100} step={0.01} error={issueFor('gstRate')} />
        <NumberField id="insurance-deduction" label="Insurance deduction" value={scenario.insuranceDeduction} onChange={(value) => set('insuranceDeduction', value)} prefix="₹" error={issueFor('insuranceDeduction')} />
        <NumberField id="other-deduction" label="Other deducted charges" value={scenario.otherDeduction} onChange={(value) => set('otherDeduction', value)} prefix="₹" error={issueFor('otherDeduction')} />
      </div>
    </GuidedSection>
    <GuidedSection step={3} title="Prepayments" description="Model one-time or recurring extra payments" optional configured={scenario.prepayments.length > 0}>
      <PrepaymentFields items={scenario.prepayments} startDate={scenario.startDate} onChange={(value) => set('prepayments', value)} issueFor={issueFor} />
    </GuidedSection>
  </div>
}
