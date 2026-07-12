import type { GenericScenario } from '../../domain/calculators'
import { DateField, NumberField } from '../CalculatorFields'
import { GuidedSection } from '../GuidedSection'
import { PrepaymentFields, RateChangeFields } from './LoanEventFields'

export function GenericForm({ scenario, onChange, issueFor }: {
  scenario: GenericScenario
  onChange: (scenario: GenericScenario) => void
  issueFor: (field: string) => string | undefined
}) {
  const set = <K extends keyof GenericScenario>(key: K, value: GenericScenario[K]) => onChange({ ...scenario, [key]: value })
  return <div className="guided-form">
    <GuidedSection step={1} title="Loan essentials" description="Principal, rate, tenure, and first EMI date" open>
      <div className="field-grid">
        <NumberField id="generic-principal" label="Loan principal" value={scenario.principal} onChange={(value) => set('principal', value)} prefix="₹" error={issueFor('principal')} />
        <NumberField id="generic-rate" label="Annual interest rate" value={scenario.annualRate} onChange={(value) => set('annualRate', value)} suffix="%" max={50} step={0.01} error={issueFor('annualRate')} />
        <NumberField id="generic-tenure" label="Loan tenure" value={scenario.tenureMonths} onChange={(value) => set('tenureMonths', Math.round(value))} suffix="months" max={480} step={1} error={issueFor('tenureMonths')} />
        <DateField id="generic-start" label="First EMI date" value={scenario.startDate} onChange={(value) => set('startDate', value)} error={issueFor('startDate')} />
      </div>
    </GuidedSection>
    <GuidedSection step={2} title="Fees" description="Add lender processing charges" optional configured={scenario.processingFee > 0}>
      <NumberField id="generic-fee" label="Processing fee" value={scenario.processingFee} onChange={(value) => set('processingFee', value)} prefix="₹" error={issueFor('processingFee')} />
    </GuidedSection>
    <GuidedSection step={3} title="Repayment changes" description="Model prepayments or future rate changes" optional configured={scenario.prepayments.length + scenario.rateChanges.length > 0}>
      <h3>Prepayments</h3><PrepaymentFields items={scenario.prepayments} startDate={scenario.startDate} onChange={(value) => set('prepayments', value)} issueFor={issueFor} />
      <h3>Rate changes</h3><RateChangeFields items={scenario.rateChanges} startDate={scenario.startDate} onChange={(value) => set('rateChanges', value)} issueFor={issueFor} />
    </GuidedSection>
  </div>
}
